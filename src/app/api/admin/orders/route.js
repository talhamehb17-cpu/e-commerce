import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error, status } = await guard('orders:read');
  if (error) return fail(error, status);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const st = searchParams.get('status') || '';
  const limit = Math.min(Number(searchParams.get('limit') || 40), 200);
  const offset = Number(searchParams.get('offset') || 0);
  const where = [];
  if (q) where.push(sql`(o.order_number ilike ${'%' + q + '%'} or o.email ilike ${'%' + q + '%'} or o.shipping_address->>'full_name' ilike ${'%' + q + '%'})`);
  if (st && st !== 'all') where.push(sql`o.status = ${st}`);
  const filter = where.length ? sql`where ${where.reduce((a, b) => sql`${a} and ${b}`)}` : sql``;
  const rows = await sql`
    select o.*, (select count(*)::int from order_items oi where oi.order_id = o.id) as item_count
    from orders o ${filter} order by o.placed_at desc limit ${limit} offset ${offset}`;
  const total = await sql`select count(*)::int n from orders o ${filter}`;
  const counts = await sql`select status, count(*)::int n from orders group by status`;
  return json({ orders: rows, total: total[0].n, counts });
}
