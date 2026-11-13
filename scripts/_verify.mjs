import postgres from 'postgres';
import fs from 'node:fs';
const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: /localhost|127\.0\.0\.1|55432/.test(process.env.DATABASE_URL) ? false : 'require' });
const rows = [
  ...(await sql`select 'category' t, name, image_url url from categories`),
  ...(await sql`select 'collection' t, name, image_url url from collections`),
  ...(await sql`select 'section' t, coalesce(title,key) name, image_url url from homepage_sections`),
  ...(await sql`select 'product' t, alt name, url from product_images`),
];
const bad = rows.filter((r) => r.url && !fs.existsSync('public' + r.url));
console.log('media rows', rows.length, '| broken', bad.length);
bad.slice(0, 10).forEach((b) => console.log(' BROKEN', b.t, b.name, b.url));
const p = await sql`select count(*)::int n, count(distinct (select url from product_images pi where pi.product_id=p.id order by position limit 1))::int distinct_img from products p`;
console.log('products', p[0].n, 'distinct covers', p[0].distinct_img);
await sql.end();
