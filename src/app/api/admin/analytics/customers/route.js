import { guard } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { sql, rateLimit } from '@/lib/db';

export const dynamic = 'force-dynamic';

function parseBounds(params) {
  const start = new Date(params.get('start') || '');
  const end = new Date(params.get('end') || '');
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end - start > 3661 * 86_400_000) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request) {
  const { admin, error, status } = await guard('customers:read');
  if (error) return fail(error, status);
  if (!rateLimit(`analytics-customers:${admin.id}`, 30, 60_000).ok) return fail('Customer analytics are rate limited. Try again shortly.', 429);
  const params = new URL(request.url).searchParams;
  const bounds = parseBounds(params);
  if (!bounds) return fail('A valid analytics date range is required.', 400);
  const query = String(params.get('q') || '').trim().slice(0, 100);
  const term = `%${query}%`;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1));
  const limit = 25;
  const offset = (page - 1) * limit;
  const searchFilter = query ? sql`and (c.name ilike ${term} or c.id::text ilike ${term})` : sql``;
  try {
    const [count, rows] = await Promise.all([
      sql`select count(*)::int total from customers c where exists (
        select 1 from orders o where o.customer_id=c.id and o.placed_at >= ${bounds.start}::timestamptz and o.placed_at < ${bounds.end}::timestamptz
      ) ${searchFilter}`,
      sql`select c.id as customer_id, c.name, count(o.id)::int order_count,
        count(o.id) filter(where o.payment_status='paid' and o.status not in ('cancelled','refunded'))::int paid_orders,
        coalesce(sum(o.grand_total) filter(where o.payment_status='paid' and o.status not in ('cancelled','refunded')),0)::bigint spend,
        min(o.placed_at) first_order, max(o.placed_at) last_order
        from customers c join orders o on o.customer_id=c.id
        where o.placed_at >= ${bounds.start}::timestamptz and o.placed_at < ${bounds.end}::timestamptz ${searchFilter}
        group by c.id,c.name order by spend desc,order_count desc,c.name limit ${limit} offset ${offset}`,
    ]);
    return json({ rows: rows.map((row) => ({ ...row, order_count: Number(row.order_count), paid_orders: Number(row.paid_orders), spend: Number(row.spend) })), total: count[0].total, page, pageSize: limit });
  } catch (cause) {
    console.error('Analytics customer query failed:', cause?.message || 'unknown error');
    return fail('Customer analytics are temporarily unavailable.', 500);
  }
}
