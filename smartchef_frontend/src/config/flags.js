/**
 * Helpers for feature flags and experiments.
 *
 * Design goals:
 * - Flags are default-OFF: if an env var is missing/malformed, features remain disabled.
 * - Flags are documented and explicitly allow-listed to avoid “mystery flags”.
 * - Components should guard both UI and any associated logic to avoid partial exposure.
 *
 * CRA env vars used:
 * - REACT_APP_FEATURE_FLAGS: comma-separated list of enabled flags (e.g. "voice")
 * - REACT_APP_EXPERIMENTS_ENABLED: "true" to enable experimental UI/features (global switch)
 */

import { getFeatureFlagsSet, isExperimentsEnabledEnv } from "./env";

/**
 * Known feature flags (documented):
 * - voice: enables optional voice input on Search page (Web Speech API).
 *
 * IMPORTANT: Unknown flags are ignored for safety and predictability.
 */
const KNOWN_FLAGS = new Set(["voice"]);

function normalizeFlagName(raw) {
  return String(raw || "").trim().toLowerCase();
}

function getEnabledKnownFlagsSet() {
  const rawSet = getFeatureFlagsSet();
  const enabled = new Set();

  for (const f of rawSet) {
    const name = normalizeFlagName(f);
    if (!name) continue;
    if (KNOWN_FLAGS.has(name)) enabled.add(name);
  }

  return enabled;
}

/**
 * PUBLIC_INTERFACE
 * Parse REACT_APP_FEATURE_FLAGS into a normalized Set of known/allowed flags.
 * Unknown flags are ignored.
 * @returns {Set<string>} set of enabled known flags
 */
export function getFeatureFlags() {
  return getEnabledKnownFlagsSet();
}

/**
 * PUBLIC_INTERFACE
 * Check if a known feature flag is enabled.
 * Unknown flags always return false.
 * @param {string} flagName flag name to check
 * @returns {boolean} true if enabled
 */
export function isFeatureEnabled(flagName) {
  const name = normalizeFlagName(flagName);
  if (!name) return false;
  return getEnabledKnownFlagsSet().has(name);
}

/**
 * PUBLIC_INTERFACE
 * Returns true if experiments are enabled.
 * NOTE: Experiments should still be used to gate whole, coherent experiences—not partial UI.
 * @returns {boolean} true if enabled
 */
export function isExperimentsEnabled() {
  return isExperimentsEnabledEnv();
}

/**
 * PUBLIC_INTERFACE
 * Helper to gate an experimental feature behind both:
 * - the global experiments switch, and
 * - a specific allow-listed flag (default off)
 *
 * This prevents accidentally exposing experimental UI when only experiments are enabled.
 *
 * @param {string} flagName
 * @returns {boolean}
 */
export function isExperimentEnabled(flagName) {
  return isExperimentsEnabledEnv() && isFeatureEnabled(flagName);
}
