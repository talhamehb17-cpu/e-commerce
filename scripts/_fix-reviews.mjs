import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const updated = await sql`
  update reviews r set is_verified = exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.product_id = r.product_id and o.customer_id = r.customer_id and o.status not in ('cancelled')
  ) returning r.id, r.is_verified`;
console.log('reviews re-evaluated:', updated.length, 'verified:', updated.filter((r) => r.is_verified).length);
await sql.end();
