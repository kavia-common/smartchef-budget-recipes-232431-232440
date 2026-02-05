/**
 * Currency helpers. Persisted currency is handled by app state.
 */

/**
 * PUBLIC_INTERFACE
 * Format a numeric amount in a given currency.
 * @param {number} amount numeric amount
 * @param {string} currency currency code (USD, EUR, GBP)
 * @returns {string} formatted currency string
 */
export function formatMoney(amount, currency) {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(safe);
  } catch {
    // Fallback when Intl doesn't support currency code
    return `${safe.toFixed(2)} ${currency}`;
  }
}

/**
 * PUBLIC_INTERFACE
 * Convert USD to another currency via a static approximate rate.
 * This is intentionally simple (no secrets / no FX API dependency).
 * @param {number} usd USD amount
 * @param {string} currency target currency (USD, EUR, GBP)
 * @returns {number} converted amount
 */
export function convertFromUsd(usd, currency) {
  const safe = Number.isFinite(usd) ? usd : 0;
  if (currency === "EUR") return safe * 0.92;
  if (currency === "GBP") return safe * 0.79;
  return safe;
}
