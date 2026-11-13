import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error, status } = await guard('reviews:read');
  if (error) return fail(error, status);
  const filter = new URL(request.url).searchParams.get('filter') || 'all';
  const where = filter === 'pending' ? sql`where not r.is_approved` : filter === 'approved' ? sql`where r.is_approved` : sql``;
  const rows = await sql`
    select r.*, p.name as product_name, p.slug as product_slug,
      c.name as customer_name, c.email as customer_email,
      exists (select 1 from order_items oi join orders o on o.id = oi.order_id
              where oi.product_id = r.product_id and o.customer_id = r.customer_id and o.status = 'delivered') as verified_order
    from reviews r left join products p on p.id = r.product_id left join customers c on c.id = r.customer_id
    ${where} order by r.created_at desc limit 200`;
  return json({ reviews: rows });
}
