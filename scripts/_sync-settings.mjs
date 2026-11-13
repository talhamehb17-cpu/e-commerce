import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const patch = {
  store: {
    name: 'NOVA',
    tagline: 'Everything, considered.',
    email: 'hello@novastore.com',
    phone: '+92 42 3571 0000',
    address: 'Studio 4, Gulberg III, Lahore, Pakistan',
    announcement: 'Free delivery over Rs 15,000 — 30-day easy returns',
    instagram: 'https://instagram.com',
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
  email: { from_name: 'NOVA', from_email: process.env.MAIL_FROM_EMAIL || '', notify_admin: true, order_updates: true, welcome: true, marketing: false },
  payments: {
    cod: true,
    bank_transfer: true,
    easypaisa: '0300 000 0000',
    jazzcash: '0300 000 0000',
    bank_details: 'Bank: Meezan Bank\nTitle: NOVA Commerce (Pvt) Ltd\nAccount: 0123 4567 8901 2345\nIBAN: PK00 MEZN 0000 0000 0000 0000',
  },
  theme: { palette: 'moonstone', allow_customer_override: true, mode: 'light' },
  analytics: { track_visitors: true },
  currency: { default: 'PKR', auto_update: true },
};
for (const [key, value] of Object.entries(patch)) {
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${sql.json(value)}, now())
    on conflict (key) do update set value = settings.value || excluded.value, updated_at = now()`;
}
console.log('settings synced:', Object.keys(patch).join(', '));
await sql.end();
