import postgres from 'postgres';
import fs from 'node:fs';
const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const rows = [
  ...(await sql`select 'category' t, name, image_url url from categories`),
  ...(await sql`select 'collection' t, name, image_url url from collections`),
  ...(await sql`select 'section' t, coalesce(title, key) as name, image_url as url from homepage_sections`),
  ...(await sql`select 'product' t, alt as name, url from product_images`),
];
const bad = rows.filter((r) => r.url && !fs.existsSync('public' + r.url));
console.log('total media rows', rows.length, '| broken', bad.length);
bad.forEach((b) => console.log('  BROKEN', b.t, b.name, b.url));
const cfg = await sql`select key, config from homepage_sections where config::text like '%images%'`;
cfg.forEach((c) => console.log('config', c.key, JSON.stringify(c.config).slice(0, 200)));
await sql.end();
