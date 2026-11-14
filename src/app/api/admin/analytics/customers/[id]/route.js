import { guard } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { sql, rateLimit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { admin, error, status } = await guard('customers:read');
  if (error) return fail(error, status);
  if (!rateLimit(`analytics-customer-detail:${admin.id}`, 60, 60_000).ok) return fail('Customer history requests are rate limited. Try again shortly.', 429);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return fail('Invalid customer id.', 400);
  const page = Math.max(1, Math.min(10000, Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1));
  const limit = 25;
  const offset = (page - 1) * limit;
  try {
    const [customer, count, orders] = await Promise.all([
      sql`select id, name, created_at from customers where id=${id} limit 1`,
      sql`select count(*)::int total from orders where customer_id=${id}`,
      sql`select o.id, o.order_number, o.placed_at, o.status, o.payment_status, o.payment_method, o.currency,
        o.grand_total, o.display_total, o.delivered_at,
        coalesce(json_agg(json_build_object('name',oi.name,'sku',oi.sku,'qty',oi.qty,'unit_price',oi.unit_price,'line_total',oi.line_total)) filter(where oi.id is not null),'[]'::json) items
        from orders o left join order_items oi on oi.order_id=o.id where o.customer_id=${id}
        group by o.id order by o.placed_at desc limit ${limit} offset ${offset}`,
    ]);
    if (!customer[0]) return fail('Customer not found.', 404);
    return json({ customer: customer[0], total: Number(count[0]?.total || 0), page, pageSize: limit, orders: orders.map((row) => ({ ...row, grand_total: Number(row.grand_total), display_total: Number(row.display_total) })) });
  } catch (cause) {
    console.error('Analytics customer detail query failed:', cause?.message || 'unknown error');
    return fail('Customer purchase history is temporarily unavailable.', 500);
  }
}
