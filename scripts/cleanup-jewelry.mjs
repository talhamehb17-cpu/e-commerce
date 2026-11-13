import postgres from 'postgres';
const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require', onnotice: () => {} });
const jewelryCats = ['rings','necklaces','earrings','bracelets','sets','archives'];
const r1 = await sql`delete from products where category_id in (select id from categories where slug = any(${jewelryCats}))`;
const r2 = await sql`delete from categories where slug = any(${jewelryCats})`;
const r3 = await sql`delete from collections where slug in ('the-pearl-edit','everyday-gold','gifting')`;
console.log('deleted products:', r1.count, 'categories:', r2.count, 'collections:', r3.count);
await sql.end();
