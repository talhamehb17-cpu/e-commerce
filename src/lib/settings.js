import { sql } from './db.js';

/** Store settings live in the `settings` table and are cached briefly. */
const CACHE = globalThis.__aurelleSettings ?? (globalThis.__aurelleSettings = new Map());
const TTL = 15_000;

const DEFAULTS = {
  store: () => ({
    name: 'NOVA',
    tagline: 'Everything, considered.',
    email: 'hello@novastore.com',
    phone: '+92 300 000 0000',
    address: 'Studio 4, Gulberg III, Lahore, Pakistan',
    announcement: 'Free delivery over Rs 15,000 — 30-day easy returns',
    announcement_starts_at: '',
    announcement_ends_at: '',
    instagram: 'https://instagram.com',
    facebook: '',
    tiktok: '',
    whatsapp: '',
    logo_text: 'NOVA',
    maintenance: false,
  }),
  shipping: () => ({
    free_threshold: 1500000, // PKR minor units (Rs 15,000)
    flat_rate: 35000, // Rs 350
    express_rate: 90000,
    cod_enabled: true,
    cod_fee: 0,
    tax_percent: 0,
    delivery_days: '3–5 business days',
    return_window_days: 30,
  }),
  theme: () => ({ palette: 'moonstone', allow_customer_override: true, mode: 'light' }),
  email: () => ({
    from_name: 'NOVA',
    from_email: '',
    notify_admin: true,
    order_updates: true,
    welcome: true,
    marketing: false,
  }),
  payments: () => ({
    cod: true,
    bank_transfer: true,
    bank_details: 'Bank: Meezan Bank\nTitle: NOVA Commerce (Pvt) Ltd\nAccount: 0123 4567 8901 2345',
    easypaisa: '0300 000 0000',
    jazzcash: '0300 000 0000',
  }),
  analytics: () => ({ track_visitors: true }),
  currency: () => ({ default: 'PKR', auto_update: true, last_sync: null }),
  seasonal: () => ({ enabled: false, season: 'none', automatic: false, intensity: 35, speed: 2, starts_at: '', ends_at: '' }),
  delivery: () => ({ reminder_minutes: 5 }),
  promotions: () => ({ popups: [] }),
};

export async function getSetting(key) {
  const hit = CACHE.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  let value = DEFAULTS[key] ? DEFAULTS[key]() : {};
  try {
    const rows = await sql`select value from settings where key = ${key} limit 1`;
    if (rows[0]?.value) value = { ...value, ...rows[0].value };
  } catch {
    /* table may not exist yet — fall back to defaults */
  }
  CACHE.set(key, { value, exp: Date.now() + TTL });
  return value;
}

export async function setSetting(key, patch) {
  const current = await getSetting(key);
  const merged = { ...current, ...patch };
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${sql.json(merged)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  CACHE.delete(key);
  return merged;
}

export async function getAllSettings() {
  const keys = Object.keys(DEFAULTS);
  const out = {};
  await Promise.all(keys.map(async (k) => (out[k] = await getSetting(k))));
  return out;
}

export const SETTING_DEFAULTS = DEFAULTS;
