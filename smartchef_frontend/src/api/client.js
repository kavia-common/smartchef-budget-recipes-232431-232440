import {
  normalizeEdamamHit,
  normalizeSpoonacularDetails,
  normalizeSpoonacularListItem
} from "./normalize";
import { getApiBase, getBackendUrl } from "../config/env";

/**
 * Decide whether to call third-party APIs directly (dev) or via backend proxy when configured.
 *
 * Wiring rules:
 * - If REACT_APP_API_BASE is set: use it directly for backend calls (e.g. https://example.com/api)
 * - Else if REACT_APP_BACKEND_URL is set: fall back to `${BACKEND_URL}/api`
 * - Else attempt direct provider calls (when keys exist); otherwise show mock data.
 */

/**
 * @typedef {"timeout"|"abort"|"http"|"network"|"parse"|"unexpected"} ApiErrorCode
 */

/**
 * @typedef {Object} ApiError
 * @property {ApiErrorCode} code
 * @property {string} message - user-friendly message
 * @property {number=} status - HTTP status if available
 * @property {string=} url
 * @property {string=} provider - "backend"|"spoonacular"|"edamam"|etc.
 * @property {any=} details - non-sensitive diagnostic payload (safe for logs)
 * @property {boolean=} retryable
 */

/**
 * @typedef {Object} ApiResponseMeta
 * @property {boolean} ok
 * @property {ApiError|null} error
 * @property {string[]} warnings
 * @property {number=} status
 * @property {string=} url
 */

/**
 * @typedef {Object} SearchRecipesResult
 * @property {any[]} recipes
 * @property {string} providerUsed
 * @property {string[]} warnings
 * @property {ApiError|null=} error
 */

/**
 * @typedef {Object} GetRecipeDetailsResult
 * @property {any|null} recipe
 * @property {string[]} warnings
 * @property {ApiError|null=} error
 */

/**
 * Defaults are intentionally conservative and do not require new env vars.
 * (UI should remain responsive even if a provider stalls.)
 */
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Small helper for later unit tests: the client accepts dependency injection via this exported factory.
 * - fetchImpl allows mocking fetch without global patching.
 * - nowImpl is used for deterministic timeout tests.
 */

// PUBLIC_INTERFACE
export function __createApiClientInternals({ fetchImpl = fetch, nowImpl = () => Date.now() } = {}) {
  /** This is a public test hook to construct unit-friendly internals. */
  return {
    fetchImpl,
    nowImpl
  };
}

function hasSpoonacularKey() {
  return Boolean((process.env.REACT_APP_SPOONACULAR_API_KEY || "").trim());
}

function hasEdamamKeys() {
  return Boolean(
    (process.env.REACT_APP_EDAMAM_APP_ID || "").trim() &&
      (process.env.REACT_APP_EDAMAM_APP_KEY || "").trim()
  );
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  return usp.toString();
}

function isAbortError(err) {
  return (
    err?.name === "AbortError" ||
    err?.code === "ABORT_ERR" ||
    String(err?.message || "").toLowerCase().includes("aborted")
  );
}

function safeString(x, fallback = "") {
  try {
    const s = String(x);
    return s;
  } catch {
    return fallback;
  }
}

/**
 * Attempt to parse JSON from a Response with defensive fallbacks.
 * Returns `{ ok: true, data }` or `{ ok:false, errorText }`.
 */
async function safeReadJson(res) {
  const contentType = (res?.headers?.get?.("content-type") || "").toLowerCase();
  const maybeJson = contentType.includes("application/json") || contentType.includes("+json");

  // Try JSON first when likely; otherwise fall back to text and try JSON.parse.
  if (maybeJson) {
    try {
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      const text = await res.text().catch(() => "");
      return { ok: false, errorText: text || safeString(e?.message, "Invalid JSON response") };
    }
  }

  const text = await res.text().catch(() => "");
  if (!text) return { ok: true, data: null };
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, errorText: text };
  }
}

function toApiError({
  code,
  message,
  status,
  url,
  provider,
  details,
  retryable
}) {
  return {
    code,
    message: message || "Request failed",
    status,
    url,
    provider,
    details,
    retryable: Boolean(retryable)
  };
}

function normalizeThrownError(err, { url, provider } = {}) {
  if (isAbortError(err)) {
    return toApiError({
      code: "abort",
      message: "Request was cancelled",
      url,
      provider,
      retryable: true
    });
  }

  // Network/CORS failures often surface as TypeError: Failed to fetch
  const msg = safeString(err?.message, "Network request failed");
  if (err instanceof TypeError) {
    return toApiError({
      code: "network",
      message: msg || "Network request failed",
      url,
      provider,
      retryable: true,
      details: { name: err?.name }
    });
  }

  return toApiError({
    code: "unexpected",
    message: msg || "Unexpected error",
    url,
    provider,
    retryable: false,
    details: { name: err?.name }
  });
}

/**
 * Core fetch wrapper:
 * - AbortController based timeout
 * - Optional external AbortSignal support (for cancellations by caller)
 * - Stable error objects (ApiError)
 *
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number, signal?: AbortSignal }} init
 * @param {{ provider?: string, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ meta: ApiResponseMeta, data: any }>}
 */
async function fetchJsonHardened(
  url,
  init = {},
  { provider = "unknown", fetchImpl = fetch } = {}
) {
  const timeoutMs =
    typeof init.timeoutMs === "number" && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0
      ? init.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const externalSignal = init.signal;

  // Bridge external cancellation into our controller.
  const onExternalAbort = () => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  };

  if (externalSignal) {
    if (externalSignal.aborted) onExternalAbort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, timeoutMs);

  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });

    const parsed = await safeReadJson(res);

    if (!res.ok) {
      const errorText = parsed.ok ? "" : parsed.errorText;
      const msg = errorText
        ? `${res.status} ${res.statusText}: ${errorText}`
        : `${res.status} ${res.statusText}`;

      return {
        meta: {
          ok: false,
          error: toApiError({
            code: "http",
            message: msg,
            status: res.status,
            url,
            provider,
            retryable: res.status >= 500 || res.status === 429,
            details: parsed.ok ? parsed.data : { body: errorText }
          }),
          warnings: [],
          status: res.status,
          url
        },
        data: null
      };
    }

    if (!parsed.ok) {
      return {
        meta: {
          ok: false,
          error: toApiError({
            code: "parse",
            message: "Received an unreadable response from the server",
            status: res.status,
            url,
            provider,
            retryable: true,
            details: { body: parsed.errorText }
          }),
          warnings: [],
          status: res.status,
          url
        },
        data: null
      };
    }

    return {
      meta: {
        ok: true,
        error: null,
        warnings: [],
        status: res.status,
        url
      },
      data: parsed.data
    };
  } catch (err) {
    const isTimeout = isAbortError(err);
    const error = isTimeout
      ? toApiError({
          code: "timeout",
          message: `Request timed out after ${timeoutMs}ms`,
          url,
          provider,
          retryable: true
        })
      : normalizeThrownError(err, { url, provider });

    return {
      meta: {
        ok: false,
        error,
        warnings: [],
        url
      },
      data: null
    };
  } finally {
    clearTimeout(timeoutHandle);
    if (externalSignal) {
      try {
        externalSignal.removeEventListener("abort", onExternalAbort);
      } catch {
        // ignore
      }
    }
  }
}

function warnMisconfiguredEnvOnce() {
  // Non-intrusive; only warns about configuration shape (no secrets).
  // eslint-disable-next-line no-console
  if (warnMisconfiguredEnvOnce.didWarn) return;
  warnMisconfiguredEnvOnce.didWarn = true;

  const backend = getBackendUrl();
  const apiBase = getApiBase();

  // If user set BACKEND_URL but API_BASE points somewhere else, it's not necessarily wrong,
  // but it's a common confusion when requests don't go where expected.
  if (backend && apiBase && !apiBase.startsWith(backend)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SmartChef] REACT_APP_API_BASE ("${apiBase}") does not start with REACT_APP_BACKEND_URL ("${backend}"). This is allowed, but ensure it's intentional.`
    );
  }
}
warnMisconfiguredEnvOnce.didWarn = false;

/**
 * Normalize any "recipe-like" list into our consistent list shape.
 * This is intentionally defensive and never throws.
 */
function normalizeRecipeListDefensively(data) {
  try {
    if (Array.isArray(data?.recipes)) return data.recipes;
    if (Array.isArray(data?.results)) return data.results.map(normalizeSpoonacularListItem);
    if (Array.isArray(data?.hits)) return data.hits.map(normalizeEdamamHit);
    return [];
  } catch {
    return [];
  }
}

/**
 * PUBLIC_INTERFACE
 * Search recipes across available providers.
 * Never throws; always returns a stable shape.
 *
 * @param {object} args search parameters
 * @param {string} args.ingredients comma-separated ingredients text
 * @param {number} args.maxBudgetUsd optional budget in USD
 * @param {string} args.diet optional diet filter
 * @param {number} args.maxReadyMinutes optional time filter
 * @param {{ signal?: AbortSignal, timeoutMs?: number, fetchImpl?: typeof fetch }=} options
 * @returns {Promise<SearchRecipesResult>}
 */
export async function searchRecipes(
  { ingredients, maxBudgetUsd, diet, maxReadyMinutes },
  options = {}
) {
  const { signal, timeoutMs, fetchImpl = fetch } = options;
  const apiBase = getApiBase();
  const warnings = [];

  // Prefer backend proxy when present (supports hiding keys server-side).
  if (apiBase) {
    warnMisconfiguredEnvOnce();
    const qs = buildQuery({ ingredients, maxBudgetUsd, diet, maxReadyMinutes });
    const { meta, data } = await fetchJsonHardened(
      `${apiBase}/recipes/search?${qs}`,
      { timeoutMs, signal },
      { provider: "backend", fetchImpl }
    );

    if (!meta.ok) {
      warnings.push("Search request failed. Showing empty results.");
      return {
        recipes: [],
        providerUsed: "backend",
        warnings,
        error: meta.error
      };
    }

    const recipes = normalizeRecipeListDefensively(data);

    // Backend may provide its own warnings/provider; we still keep ours stable.
    const backendWarnings = Array.isArray(data?.warnings) ? data.warnings.map(String) : [];
    const providerUsed = safeString(data?.provider, "backend") || "backend";

    if (!recipes.length) warnings.push("No results returned from the backend for those filters.");

    return {
      recipes,
      providerUsed,
      warnings: [...backendWarnings, ...warnings]
    };
  }

  // Direct calls: try Spoonacular, then Edamam, else mock.
  if (hasSpoonacularKey()) {
    const apiKey = process.env.REACT_APP_SPOONACULAR_API_KEY.trim();
    const qs = buildQuery({
      apiKey,
      addRecipeInformation: "true",
      number: 12,
      query: ingredients,
      diet: diet || undefined,
      maxReadyTime: maxReadyMinutes || undefined,
      maxPrice: maxBudgetUsd || undefined
    });

    const { meta, data } = await fetchJsonHardened(
      `https://api.spoonacular.com/recipes/complexSearch?${qs}`,
      { timeoutMs, signal },
      { provider: "spoonacular", fetchImpl }
    );

    if (meta.ok) {
      const recipes = Array.isArray(data?.results)
        ? data.results.map(normalizeSpoonacularListItem)
        : [];

      if (!recipes.length) warnings.push("No results from Spoonacular for those filters.");
      return { recipes, providerUsed: "spoonacular", warnings };
    }

    warnings.push("Spoonacular request failed; trying fallback provider.");
  } else {
    warnings.push("Spoonacular key not configured; skipping Spoonacular.");
  }

  if (hasEdamamKeys()) {
    const app_id = process.env.REACT_APP_EDAMAM_APP_ID.trim();
    const app_key = process.env.REACT_APP_EDAMAM_APP_KEY.trim();
    const qs = buildQuery({
      type: "public",
      app_id,
      app_key,
      q: ingredients,
      diet: diet || undefined
    });

    const { meta, data } = await fetchJsonHardened(
      `https://api.edamam.com/api/recipes/v2?${qs}`,
      { timeoutMs, signal },
      { provider: "edamam", fetchImpl }
    );

    if (!meta.ok) {
      warnings.push("Edamam request failed. Showing empty results.");
      return {
        recipes: [],
        providerUsed: "edamam",
        warnings,
        error: meta.error
      };
    }

    const recipes = Array.isArray(data?.hits) ? data.hits.map(normalizeEdamamHit) : [];
    if (!recipes.length) warnings.push("No results from Edamam for those filters.");
    return { recipes, providerUsed: "edamam", warnings };
  } else {
    warnings.push("Edamam keys not configured; skipping Edamam.");
  }

  // Mock fallback (no secrets)
  const mock = [
    {
      id: "mock-1",
      title: "Budget Veggie Stir-fry",
      imageUrl: "",
      source: "mock",
      servings: 2,
      readyInMinutes: 20,
      diets: ["vegetarian"],
      pricePerServingUsd: 2.15,
      summary: "A fast, flexible stir-fry using whatever vegetables you have.",
      ingredients: [
        { name: "Mixed vegetables", amount: "2 cups" },
        { name: "Soy sauce", amount: "2 tbsp" },
        { name: "Rice", amount: "1 cup cooked" }
      ],
      instructions: "Stir-fry veggies, add soy sauce, serve over rice."
    }
  ];

  warnings.push("No provider keys available. Showing a sample recipe instead.");
  return { recipes: mock, providerUsed: "mock", warnings };
}

/**
 * PUBLIC_INTERFACE
 * Fetch recipe details for a specific provider/id when possible.
 * Never throws; always returns a stable shape.
 *
 * If details aren't available (e.g., Edamam without a details call), returns { recipe: null }.
 *
 * @param {object} args arguments
 * @param {string} args.provider provider name
 * @param {string} args.id recipe id
 * @param {{ signal?: AbortSignal, timeoutMs?: number, fetchImpl?: typeof fetch }=} options
 * @returns {Promise<GetRecipeDetailsResult>}
 */
export async function getRecipeDetails({ provider, id }, options = {}) {
  const { signal, timeoutMs, fetchImpl = fetch } = options;
  const apiBase = getApiBase();
  const warnings = [];

  if (apiBase) {
    warnMisconfiguredEnvOnce();
    const qs = buildQuery({ provider, id });
    const { meta, data } = await fetchJsonHardened(
      `${apiBase}/recipes/details?${qs}`,
      { timeoutMs, signal },
      { provider: "backend", fetchImpl }
    );

    if (!meta.ok) {
      warnings.push("Failed to load recipe details from backend.");
      return { recipe: null, warnings, error: meta.error };
    }

    const recipe = data?.recipe ?? data ?? null;
    return { recipe, warnings };
  }

  if (provider === "spoonacular" && hasSpoonacularKey()) {
    const apiKey = process.env.REACT_APP_SPOONACULAR_API_KEY.trim();
    const url = `https://api.spoonacular.com/recipes/${encodeURIComponent(
      id
    )}/information?${buildQuery({ apiKey })}`;

    const { meta, data } = await fetchJsonHardened(
      url,
      { timeoutMs, signal },
      { provider: "spoonacular", fetchImpl }
    );

    if (!meta.ok) {
      warnings.push("Failed to load recipe details from Spoonacular.");
      return { recipe: null, warnings, error: meta.error };
    }

    try {
      return { recipe: normalizeSpoonacularDetails(data), warnings };
    } catch {
      warnings.push("Spoonacular details were in an unexpected format.");
      return {
        recipe: null,
        warnings,
        error: toApiError({
          code: "unexpected",
          message: "Unexpected recipe details format",
          url,
          provider: "spoonacular",
          retryable: false
        })
      };
    }
  }

  // For Edamam, the details are usually present on the search hit already.
  warnings.push("No detail endpoint is configured for this provider.");
  return { recipe: null, warnings };
}

/**
 * PUBLIC_INTERFACE
 * Low-level helper exposed for later unit tests/integration hooks.
 * Prefer using searchRecipes/getRecipeDetails in UI code.
 */
export const __private = {
  buildQuery,
  safeReadJson,
  fetchJsonHardened,
  normalizeThrownError,
  toApiError,
  normalizeRecipeListDefensively
};
