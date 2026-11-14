import { sql } from '@/lib/db';

const DAY = 86_400_000;
export function analyticsRange(params) {
  const end = new Date();
  const raw = Number(params.get('days') || 30);
  const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, raw)) : 30;
  const start = new Date(end.getTime() - days * DAY);
  return { start: start.toISOString(), end: end.toISOString(), days };
}

/** Every monetary total is base-currency minor units; revenue means paid, non-cancelled orders.
 * No refunds table exists in this schema, so historical refunds cannot be subtracted or reported.
 */
export async function getAnalytics(params) {
  const { start, end, days } = analyticsRange(params);
  const status = params.get('status') || null;
  const payment = params.get('payment') || null;
  const product = params.get('product') || null;
  const category = params.get('category') || null;
  const campaign = params.get('campaign') || null;
  const orders = await sql`
    with filtered as (
      select o.id, o.status, o.payment_status, o.payment_method, o.grand_total, o.discount_total, o.coupon_code, o.placed_at from orders o
      where o.placed_at >= ${start}::timestamptz and o.placed_at < ${end}::timestamptz
        and (${status}::text is null or o.status = ${status})
        and (${payment}::text is null or o.payment_method = ${payment})
        and (${campaign}::text is null or o.coupon_code = ${campaign})
        and (${product}::text is null or exists(select 1 from order_items oi where oi.order_id=o.id and oi.product_id::text=${product}))
        and (${category}::text is null or exists(select 1 from order_items oi join products p on p.id=oi.product_id where oi.order_id=o.id and p.category_id::text=${category}))
    ) select * from filtered order by placed_at desc limit 5000`;
  const previousStart = new Date(new Date(start).getTime() - days * DAY).toISOString();
  const previousRows = await sql`
    select count(*)::int orders,
      coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue
    from orders o where o.placed_at >= ${previousStart}::timestamptz and o.placed_at < ${start}::timestamptz
      and (${status}::text is null or o.status = ${status})
      and (${payment}::text is null or o.payment_method = ${payment})
      and (${campaign}::text is null or o.coupon_code = ${campaign})
      and (${product}::text is null or exists(select 1 from order_items oi where oi.order_id=o.id and oi.product_id::text=${product}))
      and (${category}::text is null or exists(select 1 from order_items oi join products p on p.id=oi.product_id where oi.order_id=o.id and p.category_id::text=${category}))`;
  const ids = orders.map(o => o.id);
  const filteredItems = ids.length ? await sql`
    select oi.name, oi.qty, oi.line_total, o.status, o.payment_status, c.name category_name
    from order_items oi join orders o on o.id=oi.order_id left join products p on p.id=oi.product_id left join categories c on c.id=p.category_id
    where oi.order_id = any(${ids})` : [];
  const eligible = orders.filter(o => !['cancelled', 'refunded'].includes(o.status));
  const paid = eligible.filter(o => o.payment_status === 'paid');
  const totals = {
    orders: orders.length,
    revenue: paid.reduce((s, o) => s + Number(o.grand_total || 0), 0),
    grossPaid: paid.reduce((s, o) => s + Number(o.grand_total || 0), 0),
    outstanding: eligible.filter(o => o.payment_status !== 'paid').reduce((s, o) => s + Number(o.grand_total || 0), 0),
    discounts: orders.reduce((s, o) => s + Number(o.discount_total || 0), 0),
    delivered: orders.filter(o => o.status === 'delivered').length,
    paidOrders: paid.length,
    units: filteredItems.filter(i => !['cancelled', 'refunded'].includes(i.status)).reduce((s, i) => s + Number(i.qty), 0),
    refunds: null,
  };
  const byDay = new Map();
  for (let n = days - 1; n >= 0; n--) {
    const d = new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
    byDay.set(d, { date: d, orders: 0, revenue: 0 });
  }
  for (const o of orders) {
    const d = new Date(o.placed_at).toISOString().slice(0, 10);
    const r = byDay.get(d); if (!r) continue;
    r.orders++;
    if (o.payment_status === 'paid' && !['cancelled', 'refunded'].includes(o.status)) r.revenue += Number(o.grand_total || 0);
  }
  const group = (keyFn) => {
    const map = new Map();
    for (const o of orders) {
      const key = keyFn(o) || 'None';
      const row = map.get(key) || { name: key, orders: 0, revenue: 0, outstanding: 0 };
      row.orders++;
      if (o.payment_status === 'paid' && !['cancelled', 'refunded'].includes(o.status)) row.revenue += Number(o.grand_total || 0);
      else if (!['cancelled', 'refunded'].includes(o.status)) row.outstanding += Number(o.grand_total || 0);
      map.set(key, row);
    }
    return [...map.values()].sort((a,b) => b.revenue - a.revenue).slice(0, 15);
  };
  const topProducts = new Map(); const categories = new Map();
  for (const i of filteredItems) {
    if (['cancelled','refunded'].includes(i.status)) continue;
    const p = topProducts.get(i.name) || { name: i.name, units: 0, revenue: 0 };
    p.units += Number(i.qty); if (i.payment_status === 'paid') p.revenue += Number(i.line_total || 0); topProducts.set(i.name, p);
    const name = i.category_name || 'Uncategorized';
    const c = categories.get(name) || { name, units: 0, revenue: 0 };
    c.units += Number(i.qty); if (i.payment_status === 'paid') c.revenue += Number(i.line_total || 0); categories.set(name, c);
  }
  const [visits, eventsResult, customers, inventory, coupons, paymentRows, products, categoryOptions] = await Promise.all([
    sql`select count(*)::int page_views, count(distinct visitor_hash)::int visitors from page_views where created_at >= ${start}::timestamptz and created_at < ${end}::timestamptz`,
    sql`select event_type, count(*)::int count, count(distinct visitor_hash)::int visitors from analytics_events where created_at >= ${start}::timestamptz and created_at < ${end}::timestamptz group by event_type`.then(rows => ({rows,available:true})).catch(() => ({rows:[],available:false})),
    sql`select count(*)::int total, count(*) filter(where created_at >= ${start}::timestamptz and created_at < ${end}::timestamptz)::int new_count, count(*) filter(where marketing_opt_in)::int opted_in from customers`,
    sql`select count(*)::int products, count(*) filter(where is_active)::int active, count(*) filter(where is_active and stock <= low_stock_threshold)::int low_stock, coalesce(sum(stock),0)::int units from products`,
    sql`select code from (select code from coupons union select distinct coupon_code as code from orders where coupon_code is not null and placed_at >= ${start}::timestamptz and placed_at < ${end}::timestamptz) c order by code limit 200`,
    Promise.resolve(group(o => o.payment_method)),
    sql`select id, name from products where is_active order by name limit 200`,
    sql`select id, name from categories where is_active order by name limit 200`,
  ]);
  const eventRows = eventsResult.rows;
  const eventMap = Object.fromEntries(eventRows.map(x => [x.event_type, { count: x.count, visitors: x.visitors }]));
  const pageViews = Number(visits[0]?.page_views || 0);
  const funnel = ['product_view','add_to_cart','checkout_started','purchase'].map(name => ({ name, ...eventMap[name] || { count: 0, visitors: 0 } }));
  return {
    range: { start, end, days }, totals, series: [...byDay.values()], status: group(o => o.status),
    payments: paymentRows, campaigns: group(o => o.coupon_code), products: [...topProducts.values()].sort((a,b)=>b.units-a.units).slice(0,15),
    categories: [...categories.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,15),
    traffic: { pageViews, visitors: Number(visits[0]?.visitors || 0), funnel, eventTrackingAvailable: eventsResult.available, historicalFunnelFrom: eventsResult.available ? 'event tracking started with this release; prior funnel events unavailable' : 'analytics_events table is not migrated; new funnel collection is currently unavailable' },
    customers: customers[0], inventory: inventory[0], coupons, filters: { products, categories: categoryOptions, statuses: [...new Set(orders.map(o=>o.status))].sort(), payments: [...new Set(orders.map(o=>o.payment_method))].sort() },
    previous: { orders: Number(previousRows[0]?.orders || 0), revenue: Number(previousRows[0]?.revenue || 0) },
    notes: { currency: 'Base store currency, minor units. Gross paid order value includes paid orders excluding cancelled/refunded status and is not refund-adjusted.', refunds: 'No refund ledger exists in the schema; refund totals and net-of-refund revenue are unavailable.', scope: orders.length >= 5000 ? 'Order rows are capped at 5,000 for this report; narrow filters or date range.' : null },
  };
}
