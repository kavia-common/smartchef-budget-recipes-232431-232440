/**
 * Helpers for feature flags and experiments.
 * Uses CRA env vars:
 * - REACT_APP_FEATURE_FLAGS: comma-separated list of enabled flags
 * - REACT_APP_EXPERIMENTS_ENABLED: "true" to enable experimental UI/features
 */

/**
 * PUBLIC_INTERFACE
 * Parse REACT_APP_FEATURE_FLAGS into a normalized Set.
 * @returns {Set<string>} set of enabled flags
 */
export function getFeatureFlags() {
  const raw = (process.env.REACT_APP_FEATURE_FLAGS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * PUBLIC_INTERFACE
 * Check if a feature flag is enabled.
 * @param {string} flagName flag name to check
 * @returns {boolean} true if enabled
 */
export function isFeatureEnabled(flagName) {
  if (!flagName) return false;
  return getFeatureFlags().has(flagName);
}

/**
 * PUBLIC_INTERFACE
 * Returns true if experiments are enabled.
 * @returns {boolean} true if enabled
 */
export function isExperimentsEnabled() {
  return String(process.env.REACT_APP_EXPERIMENTS_ENABLED || "").toLowerCase() === "true";
}
