export const BASE_CURRENCY = 'PKR';
export const MINOR_UNIT = 100;

export const CURRENCY_META = {
  PKR: { name: 'Pakistani Rupee', symbol: 'Rs', decimals: 0 },
  USD: { name: 'US Dollar', symbol: '$', decimals: 2 },
  GBP: { name: 'British Pound', symbol: '£', decimals: 2 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  CNY: { name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  AED: { name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
  SAR: { name: 'Saudi Riyal', symbol: 'SAR', decimals: 2 },
  INR: { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
};

/** Approximate fallbacks (units of PKR per 1 unit). Live rates refresh from the API. */
export const FALLBACK_RATES = {
  PKR: 1,
  USD: 278.5,
  GBP: 353.2,
  EUR: 301.7,
  CNY: 38.4,
  AED: 75.8,
  SAR: 74.3,
  INR: 3.31,
};

/**
 * Stored prices are integer minor units of PKR.
 * `rate` = how many PKR one unit of the target currency is worth.
 */
export function convertMinor(minor, rate, toDecimals = 2) {
  const baseMajor = Number(minor) / MINOR_UNIT;
  const targetMajor = baseMajor / Number(rate || 1);
  const factor = 10 ** toDecimals;
  return Math.round(targetMajor * factor * 100) / 100;
}

export function formatMoney(amountMajor, currency = BASE_CURRENCY, decimals) {
  const meta = CURRENCY_META[currency] || { symbol: currency, decimals: 2 };
  const d = decimals ?? meta.decimals;
  const n = Number(amountMajor || 0);
  const fixed = n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${meta.symbol} ${fixed}`;
}
