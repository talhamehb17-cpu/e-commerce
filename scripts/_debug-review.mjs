import postgres from 'postgres';
const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1|55432/.test(url) ? false : 'require' });
// exact query shape used by the admin dashboard
const r1 = await sql`select round(avg(rating) filter (where rating is not null), 2)::text as avg_rating, count(*)::text as total from reviews where coalesce(is_approved, true) = true`;
console.log('agg ok:', r1[0]);
const r2 = await sql`select count(*)::int n from reviews`;
console.log('count', r2[0]);
const r3 = await sql`select id, rating, is_approved, is_verified, created_at from reviews limit 8`;
console.log(r3);
const r4 = await sql`select count(*)::int n from reviews where is_approved`;
console.log('approved', r4[0]);
await sql.end();
