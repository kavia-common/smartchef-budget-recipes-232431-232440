/**
 * LocalStorage helper with safety (SSR/blocked storage) and JSON parsing.
 */

function canUseStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * PUBLIC_INTERFACE
 * Safely load a JSON value from localStorage.
 * @param {string} key storage key
 * @param {any} fallback fallback when missing or invalid
 * @returns {any} loaded value
 */
export function loadJson(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * PUBLIC_INTERFACE
 * Safely store a JSON value to localStorage.
 * @param {string} key storage key
 * @param {any} value value to serialize
 */
export function saveJson(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/security errors
  }
}
