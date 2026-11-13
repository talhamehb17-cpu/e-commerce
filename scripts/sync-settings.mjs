/**
 * Re-applies the brand-level store settings (copy, shipping rules, payment details)
 * without touching orders or catalogue data. Safe to run any time.
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }
const isLocal = /localhost|127\.0\.0\.1|55432/.test(url);
const sql = postgres(url, { max: 1, ssl: isLocal ? false : 'require', onnotice: () => {} });

const PATCH = {
  store: {
    name: 'NOVA',
    tagline: 'Everything, considered.',
    email: 'hello@novastore.com',
    phone: '+92 42 3571 0000',
    address: 'Studio 4, Gulberg III, Lahore, Pakistan',
    announcement: 'Free delivery over Rs 15,000 — 30-day easy returns',
    logo_text: 'NOVA',
    maintenance: false,
  },
  shipping: {
    free_threshold: 1500000,
    flat_rate: 25000,
    express_rate: 60000,
    cod_enabled: true,
    tax_percent: 0,
    delivery_days: '2–4 business days',
    return_window_days: 30,
  },
  theme: { palette: 'moonstone', allow_customer_override: true, mode: 'light' },
  analytics: { track_visitors: true },
  currency: { default: 'PKR', auto_update: true },
};

for (const [key, value] of Object.entries(PATCH)) {
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${sql.json(value)}, now())
    on conflict (key) do update set value = settings.value || excluded.value, updated_at = now()`;
}
const counts = await sql`select (select count(*) from products) p, (select count(*) from categories) c,
  (select count(*) from brands) b, (select count(*) from collections) co, (select count(*) from homepage_sections) s`;
console.log('✔ settings synced —', counts[0]);
await sql.end();
