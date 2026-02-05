import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { loadJson, saveJson } from "../utils/storage";

const STORAGE_KEYS = {
  favorites: "smartchef:favorites",
  grocery: "smartchef:grocery",
  currency: "smartchef:currency"
};

const initialState = {
  currency: loadJson(STORAGE_KEYS.currency, "USD"),
  favorites: loadJson(STORAGE_KEYS.favorites, []), // Array<NormalizedRecipe>
  groceryItems: loadJson(STORAGE_KEYS.grocery, []) // Array<{id,name,qty,checked}>
};

function makeId() {
  return `g_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function reducer(state, action) {
  switch (action.type) {
    case "setCurrency":
      return { ...state, currency: action.currency };

    case "toggleFavorite": {
      // Note: favorites are stored locally; order is "most recently added first".
      const exists = state.favorites.some((r) => r.id === action.recipe.id);
      const favorites = exists
        ? state.favorites.filter((r) => r.id !== action.recipe.id)
        : [action.recipe, ...state.favorites];
      return { ...state, favorites };
    }

    case "clearFavorites": {
      return { ...state, favorites: [] };
    }

    case "addGroceryItem": {
      const name = (action.name || "").trim();
      if (!name) return state;
      const next = {
        id: makeId(),
        name,
        qty: (action.qty || "").trim(),
        checked: false
      };
      return { ...state, groceryItems: [next, ...state.groceryItems] };
    }

    case "toggleGroceryChecked": {
      const groceryItems = state.groceryItems.map((i) => (i.id === action.id ? { ...i, checked: !i.checked } : i));
      return { ...state, groceryItems };
    }

    case "removeGroceryItem": {
      const groceryItems = state.groceryItems.filter((i) => i.id !== action.id);
      return { ...state, groceryItems };
    }

    case "clearChecked": {
      const groceryItems = state.groceryItems.filter((i) => !i.checked);
      return { ...state, groceryItems };
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
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * Provider for SmartChef app state.
 */
export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const actions = useMemo(() => buildActions(dispatch), [dispatch]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.currency, state.currency);
  }, [state.currency]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.favorites, state.favorites);
  }, [state.favorites]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.grocery, state.groceryItems);
  }, [state.groceryItems]);

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
