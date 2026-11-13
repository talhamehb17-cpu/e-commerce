import { sql, cached } from './db.js';
import { CURRENCY_META, FALLBACK_RATES, BASE_CURRENCY } from './money.js';

export async function getCurrencies() {
  return cached('currencies', 30_000, async () => {
    try {
      const rows = await sql`select code, name, symbol, rate_to_base, decimals, is_active, is_default, manual_override from currencies where is_active order by is_default desc, code`;
      if (rows.length) {
        return rows.map((r) => ({
          code: r.code,
          name: r.name,
          symbol: r.symbol,
          rate: Number(r.rate_to_base),
          decimals: r.decimals,
          isDefault: r.is_default,
        }));
      }
    } catch {
      /* fall through */
    }
    return Object.keys(FALLBACK_RATES).map((code) => ({
      code,
      name: CURRENCY_META[code].name,
      symbol: CURRENCY_META[code].symbol,
      rate: FALLBACK_RATES[code],
      decimals: CURRENCY_META[code].decimals,
      isDefault: code === BASE_CURRENCY,
    }));
  });
}

export async function refreshExchangeRates() {
  const endpoint = process.env.EXCHANGE_RATE_API || 'https://open.er-api.com/v6/latest';
  const res = await fetch(`${endpoint}/${BASE_CURRENCY}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('rate provider responded ' + res.status);
  const data = await res.json();
  const rates = data?.rates;
  if (!rates) throw new Error('rate provider returned no rates');
  const manual = await sql`select code from currencies where manual_override`;
  const manualSet = new Set(manual.map((m) => m.code));
  let updated = 0;
  for (const [code, rate] of Object.entries(rates)) {
    if (!Number.isFinite(rate) || manualSet.has(code) || code === BASE_CURRENCY) continue;
    const meta = CURRENCY_META[code];
    const decimals = meta?.decimals ?? 2;
    await sql`
      insert into currencies (code, name, symbol, rate_to_base, decimals, is_active)
      values (${code}, ${meta?.name || code}, ${meta?.symbol || code}, ${rate}, ${decimals}, false)
      on conflict (code) do update set rate_to_base = excluded.rate_to_base, updated_at = now()
      where currencies.manual_override = false
    `;
    updated++;
  }
  await sql`update currencies set rate_to_base = 1, updated_at = now() where code = ${BASE_CURRENCY}`;
  return { updated, provider: endpoint, fetched_at: data.time_last_update_utc || new Date().toISOString() };
}

/** Convert stored PKR minor units into a display string for the active currency. */
export function displayPrice(minor, currency, currencies) {
  const list = currencies || [];
  const cur = list.find((c) => c.code === currency) || list.find((c) => c.code === BASE_CURRENCY) || { code: BASE_CURRENCY, symbol: 'Rs', rate: 1, decimals: 0 };
  const major = Number(minor || 0) / 100;
  const converted = major / Number(cur.rate || 1);
  const d = cur.decimals ?? 2;
  const n = converted.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return { text: `${cur.symbol} ${n}`, amount: converted, currency: cur.code, decimals: d, symbol: cur.symbol };
}

export function convertMajor(minor, currency, currencies) {
  const list = currencies || [];
  const cur = list.find((c) => c.code === currency) || list[0] || { rate: 1 };
  return (Number(minor || 0) / 100) / Number(cur.rate || 1);
}
