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
  JPY: { name: 'Japanese Yen', symbol: '¥', decimals: 0 }, CAD: { name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  AUD: { name: 'Australian Dollar', symbol: 'A$', decimals: 2 }, CHF: { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 }, MYR: { name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  TRY: { name: 'Turkish Lira', symbol: '₺', decimals: 2 }, KWD: { name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3 },
  QAR: { name: 'Qatari Riyal', symbol: 'QR', decimals: 2 }, BHD: { name: 'Bahraini Dinar', symbol: 'BD', decimals: 3 },
  OMR: { name: 'Omani Rial', symbol: 'OMR', decimals: 3 }, ZAR: { name: 'South African Rand', symbol: 'R', decimals: 2 },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 }, HKD: { name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
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
  INR: 3.31, JPY: 1.84, CAD: 203.5, AUD: 181.5, CHF: 315.5, SGD: 207.8, MYR: 62.1,
  TRY: 7.9, KWD: 907, QAR: 76.5, BHD: 740, OMR: 724, ZAR: 15.2, NZD: 166, HKD: 35.7,
};

/**
 * Stored prices are integer minor units of PKR.
 * `rate` = how many PKR one unit of the target currency is worth.
 */
export function convertMinor(minor, rate, toDecimals = 2) {
  const baseMajor = Number(minor) / MINOR_UNIT;
  const targetMajor = baseMajor / Number(rate || 1);
  const factor = 10 ** toDecimals;
  return Math.round(targetMajor * factor) / factor;
}

export function formatMoney(amountMajor, currency = BASE_CURRENCY, decimals) {
  const meta = CURRENCY_META[currency] || { symbol: currency, decimals: 2 };
  const d = decimals ?? meta.decimals;
  const n = Number(amountMajor || 0);
  const fixed = n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${meta.symbol} ${fixed}`;
}
