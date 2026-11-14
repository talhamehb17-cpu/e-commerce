import { sql } from './db.js';

const DAY = 86_400_000;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isoDay = (date) => date.toISOString().slice(0, 10);
const num = (value) => Number(value || 0);
const percentChange = (current, previous) => previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;

export function resolveStatsPeriod(searchParams = new URLSearchParams()) {
  const fromInput = searchParams.get('from');
  const toInput = searchParams.get('to');
  if (fromInput || toInput) {
    if (!validDate(fromInput) || !validDate(toInput)) return { error: 'Choose a valid start and end date.' };
    const fromMs = Date.parse(`${fromInput}T00:00:00Z`);
    const toMs = Date.parse(`${toInput}T00:00:00Z`);
    const days = Math.floor((toMs - fromMs) / DAY) + 1;
    if (days < 1 || days > 366) return { error: 'Choose a date range of 1 to 366 days.' };
    if (toMs > Date.parse(`${isoDay(new Date())}T00:00:00Z`)) return { error: 'The end date cannot be in the future.' };
    return { from: fromInput, to: toInput, days, preset: 'custom' };
  }
  const rawRange = Number(searchParams.get('range') || 30);
  const days = [7, 30, 90, 365].includes(rawRange) ? rawRange : 30;
  const to = isoDay(new Date());
  const from = isoDay(new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY));
  return { from, to, days, preset: String(days) };
}

export async function getAdminStats(period) {
  const { from, to, days } = period;
  const fromTs = new Date(`${from}T00:00:00.000Z`);
  const toExclusive = new Date(Date.parse(`${to}T00:00:00.000Z`) + DAY);
  const previousFrom = new Date(fromTs.getTime() - days * DAY);
  const previousTo = fromTs;

  const [totalsRows, statusCounts, series, topProducts, topCategories, recentOrders, lowStockProducts, monthlyRevenue] = await Promise.all([
    sql`
      select
        (select count(*)::int from orders) as orders_all,
        (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive}) as orders_period,
        (select count(*)::int from customers) as customers_all,
        (select count(*)::int from customers where created_at >= ${fromTs} and created_at < ${toExclusive}) as customers_period,
        (select count(*)::int from products where is_active) as products_active,
        (select count(*)::int from products where is_active and stock <= low_stock_threshold and stock > 0) as low_stock,
        (select count(*)::int from products where is_active and stock = 0) as out_of_stock,
        (select count(*)::int from products where is_active and stock > low_stock_threshold) as healthy_stock,
        (select count(*)::int from reviews where not is_approved) as pending_reviews,
        (select count(*)::int from page_views where created_at >= ${fromTs} and created_at < ${toExclusive}) as page_views,
        (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled','returned') and placed_at >= ${fromTs} and placed_at < ${toExclusive}) as revenue_period,
        (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled','returned')) as revenue_all,
        (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled','returned') and placed_at >= ${previousFrom} and placed_at < ${previousTo}) as revenue_previous,
        (select count(*)::int from orders where placed_at >= ${previousFrom} and placed_at < ${previousTo}) as orders_previous,
        (select count(*)::int from customers where created_at >= ${previousFrom} and created_at < ${previousTo}) as customers_previous,
        (select coalesce(avg(grand_total),0)::bigint from orders where status not in ('cancelled','returned') and placed_at >= ${fromTs} and placed_at < ${toExclusive}) as average_order_value,
        (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive} and status = 'pending') as pending_orders,
        (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive} and status = 'delivered') as delivered_orders,
        (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive} and status = 'cancelled') as cancelled_orders,
        (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive} and status = 'returned') as returned_orders,
        (select count(*)::int from email_logs where status = 'failed') as email_failures
    `,
    sql`select status, count(*)::int as n, coalesce(sum(grand_total),0)::bigint as value
        from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive} group by status order by status`,
    sql`
      with days as (
        select generate_series(${from}::date, ${to}::date, interval '1 day')::date as d
      )
      select d::text as date,
        coalesce((select sum(grand_total) from orders o where o.placed_at >= d and o.placed_at < d + interval '1 day' and o.status not in ('cancelled','returned')),0)::bigint as revenue,
        coalesce((select sum(grand_total) from orders o where o.placed_at >= d - (${days} * interval '1 day') and o.placed_at < d - ((${days} - 1) * interval '1 day') and o.status not in ('cancelled','returned')),0)::bigint as compare_revenue,
        coalesce((select count(*) from orders o where o.placed_at >= d and o.placed_at < d + interval '1 day'),0)::int as orders,
        coalesce((select count(*) from customers c where c.created_at >= d and c.created_at < d + interval '1 day'),0)::int as customers,
        coalesce((select count(distinct visitor_hash) from page_views p where p.created_at >= d and p.created_at < d + interval '1 day' and visitor_hash is not null),0)::int as visitor_days
      from days order by d
    `,
    sql`
      select oi.product_id, oi.name, sum(oi.qty)::int as units, sum(oi.line_total)::bigint as revenue
      from order_items oi join orders o on o.id = oi.order_id
      where o.status not in ('cancelled','returned') and o.placed_at >= ${fromTs} and o.placed_at < ${toExclusive}
      group by oi.product_id, oi.name order by revenue desc limit 8
    `,
    sql`
      select coalesce(c.name, 'Uncategorised') as name, coalesce(sum(oi.line_total),0)::bigint as revenue, count(distinct o.id)::int as orders
      from order_items oi join orders o on o.id = oi.order_id
      join products p on p.id = oi.product_id left join categories c on c.id = p.category_id
      where o.status not in ('cancelled','returned') and o.placed_at >= ${fromTs} and o.placed_at < ${toExclusive}
      group by c.name order by revenue desc limit 8
    `,
    sql`select o.id, o.order_number, o.status, o.grand_total, o.currency, o.placed_at, o.email,
        o.shipping_address->>'full_name' as customer_name
        from orders o order by o.placed_at desc limit 8`,
    sql`select id, name, slug, stock, low_stock_threshold from products
        where stock <= low_stock_threshold and is_active order by stock asc limit 8`,
    sql`select date_trunc('month', o.placed_at)::date::text as month,
        coalesce(sum(o.grand_total),0)::bigint as revenue, count(*)::int as orders
        from orders o where o.placed_at >= ${fromTs} and o.placed_at < ${toExclusive}
        and o.status not in ('cancelled','returned') group by 1 order by 1`,
  ]);

  const row = totalsRows[0] || {};
  const delivered = num(row.delivered_orders);
  const returned = num(row.returned_orders);
  const terminalDeliveries = delivered + returned;
  const activeProducts = num(row.products_active);
  const visitorDays = (series || []).reduce((sum, item) => sum + num(item.visitor_days), 0);
  const revenue = num(row.revenue_period);
  const revenuePreviousValue = num(row.revenue_previous);
  const ordersPeriod = num(row.orders_period);
  const ordersPreviousValue = num(row.orders_previous);
  const customers = num(row.customers_period);
  const customersPreviousValue = num(row.customers_previous);
  const revenueEligibleOrders = (statusCounts || []).filter((s) => !['cancelled', 'returned'].includes(s.status)).reduce((sum, s) => sum + num(s.n), 0);

  return {
    from,
    to,
    days,
    preset: period.preset,
    totals: {
      revenue: revenue,
      revenueAll: num(row.revenue_all),
      revenuePrevious: revenuePreviousValue,
      revenueGrowth: percentChange(revenue, revenuePreviousValue),
      orders: num(row.orders_all),
      ordersPeriod,
      ordersPrevious: ordersPreviousValue,
      ordersGrowth: percentChange(ordersPeriod, ordersPreviousValue),
      customers: num(row.customers_all),
      customersPeriod: customers,
      customersPrevious: customersPreviousValue,
      customersGrowth: percentChange(customers, customersPreviousValue),
      products: activeProducts,
      lowStock: num(row.low_stock),
      outOfStock: num(row.out_of_stock),
      healthyStock: num(row.healthy_stock),
      pendingReviews: num(row.pending_reviews),
      pageViews: num(row.page_views),
      visitorDays,
      aov: num(row.average_order_value),
      pendingOrders: num(row.pending_orders),
      deliveredOrders: delivered,
      cancelledOrders: num(row.cancelled_orders),
      returnedOrders: returned,
      completionRate: ordersPeriod ? Number(((delivered / ordersPeriod) * 100).toFixed(1)) : 0,
      deliverySuccessRate: terminalDeliveries ? Number(((delivered / terminalDeliveries) * 100).toFixed(1)) : null,
      inventoryHealth: activeProducts ? Number(((num(row.healthy_stock) / activeProducts) * 100).toFixed(1)) : 0,
      revenueOrderCount: revenueEligibleOrders,
      emailFailures: num(row.email_failures),
      conversionRate: null,
    },
    statusCounts: (statusCounts || []).map((item) => ({ status: item.status, n: num(item.n), value: num(item.value) })),
    series: (series || []).map((item) => ({
      date: item.date,
      revenue: num(item.revenue),
      compareRevenue: num(item.compare_revenue),
      orders: num(item.orders),
      customers: num(item.customers),
      visitorDays: num(item.visitor_days),
    })),
    topProducts: (topProducts || []).map((item) => ({ ...item, units: num(item.units), revenue: num(item.revenue) })),
    topCategories: (topCategories || []).map((item) => ({ ...item, revenue: num(item.revenue), orders: num(item.orders) })),
    recentOrders: (recentOrders || []).map((item) => ({ ...item, grand_total: num(item.grand_total) })),
    lowStockProducts: lowStockProducts || [],
    monthlyRevenue: (monthlyRevenue || []).map((item) => ({ ...item, revenue: num(item.revenue), orders: num(item.orders) })),
  };
}
