import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadJson, saveJson } from "../utils/storage";

/**
 * AppState persistence design notes
 *
 * - We persist a single versioned "envelope" to localStorage for migration safety.
 * - Schema versioning:
 *   - STORAGE_SCHEMA_VERSION increments when the persisted shape changes.
 *   - On load, we migrate older versions forward and sanitize/validate every field.
 *
 * - Stable IDs for recipes/favorites:
 *   - We store a composite key derived from provider/source + providerId: `${provider}:${id}`.
 *   - This prevents collisions between providers and makes favorites stable across UI routes.
 *
 * - Dedupe rules:
 *   - Favorites: dedupe by composite key (case-insensitive provider, stringified id).
 *   - Grocery items: dedupe by normalized name key (trim + collapse whitespace + lowercase).
 *
 * - Reliability:
 *   - We validate before write and sanitize on read to prevent corruption.
 *   - Storage may be missing/blocked (privacy mode, quota, SSR); we fall back to in-memory state
 *     and expose a user-friendly warning string via state.storageWarning (non-blocking).
 */

const STORAGE_KEYS = {
  appState: "smartchef:appstate"
};

const STORAGE_SCHEMA_VERSION = 1;

const DEFAULT_CURRENCY = "USD";
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP"]);

function normalizeText(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function normalizeProvider(raw) {
  return normalizeText(raw).toLowerCase();
}

function normalizeRecipeId(raw) {
  // Always store IDs as strings (provider-specific IDs can be numeric, URIs, etc.)
  return normalizeText(raw);
}

// PUBLIC_INTERFACE
export function getRecipeKey(recipeLike) {
  /** Derive a stable composite key `${provider}:${id}` for a recipe-like object. */
  const provider = normalizeProvider(recipeLike?.source || recipeLike?.provider || "unknown");
  const id = normalizeRecipeId(recipeLike?.id);
  return `${provider}:${id}`;
}

function sanitizeCurrency(raw) {
  const c = normalizeText(raw) || DEFAULT_CURRENCY;
  if (ALLOWED_CURRENCIES.has(c)) return c;
  return DEFAULT_CURRENCY;
}

function sanitizeRecipe(recipeLike) {
  if (!recipeLike || typeof recipeLike !== "object") return null;

  const source = normalizeProvider(recipeLike.source || recipeLike.provider || "");
  const id = normalizeRecipeId(recipeLike.id);
  if (!source || !id) return null;

  // Keep the rest of the recipe as-is (UI expects these fields), but ensure stable primitives.
  const title = normalizeText(recipeLike.title || "Untitled recipe") || "Untitled recipe";

  const normalized = {
    ...recipeLike,
    id,
    source,
    title
  };

  // Ensure optional list fields are arrays when present.
  if (normalized.diets && !Array.isArray(normalized.diets)) normalized.diets = [];
  if (normalized.ingredients && !Array.isArray(normalized.ingredients)) normalized.ingredients = [];

  return normalized;
}

function sanitizeFavorites(list) {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];

  for (const item of arr) {
    const r = sanitizeRecipe(item);
    if (!r) continue;
    const key = getRecipeKey(r);

    // Dedupe by composite key.
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(r);
  }

  // Preserve stored order: we assume newest-first semantics.
  return out;
}

function makeId() {
  return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function groceryKey(name) {
  // Normalize for comparisons (case/whitespace-insensitive).
  return normalizeText(name).toLowerCase();
}

function sanitizeGroceryItems(list) {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;

    const name = normalizeText(item.name);
    if (!name) continue;

    const key = groceryKey(name);
    if (seen.has(key)) {
      // Merge rule: if duplicate appears, prefer the first occurrence (closest to top),
      // but try to keep a quantity if one exists.
      const existing = out.find((x) => groceryKey(x.name) === key);
      if (existing && !existing.qty) existing.qty = normalizeText(item.qty);
      continue;
    }

    seen.add(key);

    const qty = normalizeText(item.qty);
    const checked = Boolean(item.checked);
    const id = normalizeText(item.id) || makeId();

    out.push({ id, name, qty, checked });
  }

  return out;
}

function sanitizePersistedEnvelope(raw) {
  // Envelope: { v:number, data:{ currency, favorites, groceryItems } }
  if (!raw || typeof raw !== "object") return null;

  const v = Number.isFinite(raw.v) ? raw.v : Number(raw.v);
  const data = raw.data && typeof raw.data === "object" ? raw.data : {};

  return {
    v: Number.isFinite(v) ? v : 0,
    data
  };
}

function migrateEnvelopeToLatest(envelope) {
  const safe = sanitizePersistedEnvelope(envelope);
  if (!safe) {
    return {
      v: STORAGE_SCHEMA_VERSION,
      data: { currency: DEFAULT_CURRENCY, favorites: [], groceryItems: [] }
    };
  }

  // v0: previously we stored separate keys; if a legacy object somehow exists,
  // treat its fields as direct data.
  if (!safe.v) {
    const legacyData = safe.data || safe;
    return {
      v: STORAGE_SCHEMA_VERSION,
      data: {
        currency: legacyData.currency,
        favorites: legacyData.favorites,
        groceryItems: legacyData.groceryItems
      }
    };
  }

  // Future versions: add migrations here.
  if (safe.v >= STORAGE_SCHEMA_VERSION) {
    return { v: STORAGE_SCHEMA_VERSION, data: safe.data || {} };
  }

  // Example placeholder:
  // if (safe.v === 1) { ...; return { v: 2, data: migrated } }

  return { v: STORAGE_SCHEMA_VERSION, data: safe.data || {} };
}

function loadInitialState() {
  const warnings = [];

  // Load versioned envelope first.
  const envelopeRaw = loadJson(STORAGE_KEYS.appState, null);

  // Also support older installs that used separate keys (migration path).
  // If envelope isn't present, attempt legacy keys.
  const legacyFavorites = loadJson("smartchef:favorites", null);
  const legacyGrocery = loadJson("smartchef:grocery", null);
  const legacyCurrency = loadJson("smartchef:currency", null);

  const hadEnvelope = envelopeRaw != null;
  const hadLegacy =
    legacyFavorites != null || legacyGrocery != null || legacyCurrency != null;

  const migrated = migrateEnvelopeToLatest(
    hadEnvelope
      ? envelopeRaw
      : {
          v: 0,
          data: {
            favorites: legacyFavorites,
            groceryItems: legacyGrocery,
            currency: legacyCurrency
          }
        }
  );

  const currency = sanitizeCurrency(migrated?.data?.currency);
  const favorites = sanitizeFavorites(migrated?.data?.favorites);
  const groceryItems = sanitizeGroceryItems(migrated?.data?.groceryItems);

  if (hadLegacy && !hadEnvelope) {
    warnings.push("Upgraded local data format for improved reliability.");
  }

  return {
    state: {
      currency,
      favorites, // Array<NormalizedRecipe>
      groceryItems, // Array<{id,name,qty,checked}>
      storageWarning: "" // populated if storage writes fail
    },
    warnings
  };
}

function buildPersistableState(state) {
  return {
    v: STORAGE_SCHEMA_VERSION,
    data: {
      currency: sanitizeCurrency(state.currency),
      favorites: sanitizeFavorites(state.favorites),
      groceryItems: sanitizeGroceryItems(state.groceryItems)
    }
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "setStorageWarning":
      return { ...state, storageWarning: action.message || "" };

    case "setCurrency":
      return { ...state, currency: sanitizeCurrency(action.currency) };

    case "toggleFavorite": {
      // Note: favorites are stored locally; order is "most recently added first".
      const recipe = sanitizeRecipe(action.recipe);
      if (!recipe) return state;

      const key = getRecipeKey(recipe);

      const exists = state.favorites.some((r) => getRecipeKey(r) === key);
      const favorites = exists
        ? state.favorites.filter((r) => getRecipeKey(r) !== key)
        : [recipe, ...state.favorites];

      return { ...state, favorites: sanitizeFavorites(favorites) };
    }

    case "clearFavorites": {
      return { ...state, favorites: [] };
    }

    case "addGroceryItem": {
      const name = normalizeText(action.name);
      const qty = normalizeText(action.qty);

      if (!name) return state;

      const key = groceryKey(name);
      const existing = state.groceryItems.find((i) => groceryKey(i.name) === key);

      // If already present, we "nudge" it to the top and optionally update qty if provided.
      if (existing) {
        const updated = {
          ...existing,
          name, // keep normalized display
          qty: qty || existing.qty
        };
        const rest = state.groceryItems.filter((i) => i.id !== existing.id);
        return { ...state, groceryItems: sanitizeGroceryItems([updated, ...rest]) };
      }

      const next = {
        id: makeId(),
        name,
        qty,
        checked: false
      };
      return { ...state, groceryItems: sanitizeGroceryItems([next, ...state.groceryItems]) };
    }

    case "toggleGroceryChecked": {
      const id = normalizeText(action.id);
      if (!id) return state;

      const groceryItems = state.groceryItems.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i
      );
      return { ...state, groceryItems: sanitizeGroceryItems(groceryItems) };
    }

    case "removeGroceryItem": {
      const id = normalizeText(action.id);
      if (!id) return state;

      const groceryItems = state.groceryItems.filter((i) => i.id !== id);
      return { ...state, groceryItems: sanitizeGroceryItems(groceryItems) };
    }

    case "clearChecked": {
      const groceryItems = state.groceryItems.filter((i) => !i.checked);
      return { ...state, groceryItems: sanitizeGroceryItems(groceryItems) };
    }

    case "clearAllGroceryItems": {
      return { ...state, groceryItems: [] };
    }

    default:
      return state;
  }
}

const AppStateContext = createContext(null);

function buildActions(dispatch) {
  return {
    // PUBLIC_INTERFACE
    setCurrency(currency) {
      dispatch({ type: "setCurrency", currency });
    },
    // PUBLIC_INTERFACE
    toggleFavorite(recipe) {
      dispatch({ type: "toggleFavorite", recipe });
    },
    // PUBLIC_INTERFACE
    clearFavorites() {
      /** Clear all favorites (local-only). */
      dispatch({ type: "clearFavorites" });
    },
    // PUBLIC_INTERFACE
    addGroceryItem(name, qty) {
      dispatch({ type: "addGroceryItem", name, qty });
    },
    // PUBLIC_INTERFACE
    toggleGroceryChecked(id) {
      dispatch({ type: "toggleGroceryChecked", id });
    },
    // PUBLIC_INTERFACE
    removeGroceryItem(id) {
      dispatch({ type: "removeGroceryItem", id });
    },
    // PUBLIC_INTERFACE
    clearChecked() {
      dispatch({ type: "clearChecked" });
    },
    // PUBLIC_INTERFACE
    clearAllGroceryItems() {
      /** Clear entire grocery list (local-only). */
      dispatch({ type: "clearAllGroceryItems" });
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * Provider for SmartChef app state.
 */
export function AppStateProvider({ children }) {
  const initRef = useRef(null);
  if (!initRef.current) {
    initRef.current = loadInitialState();
  }

  const [{ state: seededState, warnings: loadWarnings }] = useState(() => initRef.current);

  const [state, dispatch] = useReducer(reducer, seededState);
  const actions = useMemo(() => buildActions(dispatch), [dispatch]);

  // Persist envelope on any relevant state change.
  useEffect(() => {
    const envelope = buildPersistableState(state);
    try {
      saveJson(STORAGE_KEYS.appState, envelope);

      // Also keep legacy keys updated for one version to reduce "downgrade surprises"
      // (safe no-op if storage is blocked).
      saveJson("smartchef:currency", envelope.data.currency);
      saveJson("smartchef:favorites", envelope.data.favorites);
      saveJson("smartchef:grocery", envelope.data.groceryItems);

      // If we previously warned, clear after a successful write.
      if (state.storageWarning) dispatch({ type: "setStorageWarning", message: "" });
    } catch {
      // saveJson is already safe, but keep this guard for future changes.
      dispatch({
        type: "setStorageWarning",
        message:
          "Your browser is blocking local storage. Favorites and grocery list will work for this session but won’t be saved."
      });
    }
    // We intentionally persist off the *sanitized* envelope to avoid corruption.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currency, state.favorites, state.groceryItems]);

  // Best-effort: surface a one-time warning if migration happened.
  useEffect(() => {
    if (!loadWarnings?.length) return;
    // eslint-disable-next-line no-console
    console.warn(`[SmartChef] ${loadWarnings.join(" ")}`);
  }, [loadWarnings]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/**
 * PUBLIC_INTERFACE
 * Hook to access app state/actions.
 */
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
