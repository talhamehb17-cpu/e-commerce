import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error, status } = await guard('customers:read');
  if (error) return fail(error, status);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const filter = q ? sql`where (c.name ilike ${'%' + q + '%'} or c.email ilike ${'%' + q + '%'})` : sql``;
  const rows = await sql`
    select c.id, c.name, c.email, c.phone, c.email_verified, c.is_blocked, c.created_at, c.last_login_at,
      (select count(*)::int from orders o where o.customer_id = c.id) as order_count,
      (select coalesce(sum(grand_total),0)::bigint from orders o where o.customer_id = c.id and o.status not in ('cancelled')) as lifetime_value
    from customers c ${filter} order by c.created_at desc limit 200`;
  return json({ customers: rows });
}
