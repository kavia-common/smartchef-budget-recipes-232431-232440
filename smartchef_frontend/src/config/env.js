/**
 * Centralized environment variable parsing for SmartChef (CRA).
 *
 * Goals:
 * - Guard against undefined/malformed env vars so the app never crashes.
 * - Provide safe defaults that preserve functionality (no secrets).
 * - Provide light, non-intrusive diagnostics via console.warn (dev-friendly).
 */

let didWarn = false;

function warnOnce(message) {
  if (didWarn) return;
  didWarn = true;
  // Non-intrusive diagnostics only.
  // eslint-disable-next-line no-console
  console.warn(message);
}

function normalizeBaseUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  // Remove trailing slashes to make URL joining predictable.
  return v.replace(/\/+$/, "");
}

function parseBoolean(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return false;
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function parseCsvSet(raw) {
  const v = String(raw || "").trim();
  if (!v) return new Set();
  return new Set(
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

// PUBLIC_INTERFACE
export function getBackendUrl() {
  /** Returns normalized backend base URL (no trailing slash) or "" if unset. */
  return normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL);
}

// PUBLIC_INTERFACE
export function getApiBase() {
  /**
   * Returns normalized API base URL.
   * If REACT_APP_API_BASE is unset, it falls back to `${REACT_APP_BACKEND_URL}/api` when backend is set,
   * else returns "" to indicate "use direct provider calls".
   */
  const explicit = normalizeBaseUrl(process.env.REACT_APP_API_BASE);
  if (explicit) return explicit;

  const backend = getBackendUrl();
  return backend ? `${backend}/api` : "";
}

// PUBLIC_INTERFACE
export function getFeatureFlagsSet() {
  /** Returns feature flags as a Set<string>. */
  return parseCsvSet(process.env.REACT_APP_FEATURE_FLAGS);
}

// PUBLIC_INTERFACE
export function isExperimentsEnabledEnv() {
  /** Returns true if REACT_APP_EXPERIMENTS_ENABLED is a truthy boolean string. */
  return parseBoolean(process.env.REACT_APP_EXPERIMENTS_ENABLED);
}

// PUBLIC_INTERFACE
export function logEnvDiagnostics() {
  /**
   * Logs a one-time warning when expected env vars are not set.
   * This should not expose secrets; only presence/absence and non-sensitive values.
   */
  const backend = getBackendUrl();
  const apiBase = getApiBase();
  const flagsRaw = String(process.env.REACT_APP_FEATURE_FLAGS || "").trim();
  const experiments = isExperimentsEnabledEnv();

  if (!backend && !apiBase) {
    warnOnce(
      "[SmartChef] Neither REACT_APP_BACKEND_URL nor REACT_APP_API_BASE is set. The app will use direct provider calls when keys are available, otherwise it will show mock results."
    );
    return;
  }

  if (backend && !apiBase) {
    // apiBase will default to `${backend}/api` through getApiBase(); this note helps avoid confusion.
    warnOnce(
      `[SmartChef] REACT_APP_API_BASE is not set. Falling back to "${backend}/api" based on REACT_APP_BACKEND_URL.`
    );
    return;
  }

  if (flagsRaw && getFeatureFlagsSet().size === 0) {
    warnOnce(
      "[SmartChef] REACT_APP_FEATURE_FLAGS is set but no valid flags were parsed. Expected a comma-separated list, e.g. REACT_APP_FEATURE_FLAGS=voice"
    );
    return;
  }

  if (process.env.REACT_APP_EXPERIMENTS_ENABLED != null && String(process.env.REACT_APP_EXPERIMENTS_ENABLED).trim() !== "" && !experiments) {
    warnOnce(
      `[SmartChef] REACT_APP_EXPERIMENTS_ENABLED is set to "${process.env.REACT_APP_EXPERIMENTS_ENABLED}" but was not recognized as true. Use "true" to enable experiments.`
    );
  }
}
