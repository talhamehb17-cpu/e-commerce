import { sql } from './db.js';

const DAY = 86_400_000;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const shiftDate = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const num = (value) => Number(value || 0);
const percentChange = (current, previous) => previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;
function todayInTimezone(timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function resolveStatsPeriod(searchParams = new URLSearchParams(), timezone = 'Asia/Karachi') {
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { timezone = 'Asia/Karachi'; }
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const today = todayInTimezone(timezone);
  if (from || to) {
    if (!validDate(from) || !validDate(to) || from > to) return { error: 'Choose a valid start and end date.' };
    const days = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
    if (days < 1 || days > 366) return { error: 'Choose a date range of 1 to 366 days.' };
    if (to > today) return { error: 'The end date cannot be in the future.' };
    return { from, to, days, preset: 'custom', timezone };
  }
  const parsed = Number(searchParams.get('range') || 30);
  const days = [7, 30, 90, 365].includes(parsed) ? parsed : 30;
  return { from: shiftDate(today, -(days - 1)), to: today, days, preset: String(days), timezone };
}

/** Dashboard summary only. Detailed time-series aggregations live in the Analytics Center API. */
export async function getAdminStats(period) {
  const { from, to, days, timezone = 'Asia/Karachi' } = period;
  const exclusiveTo = shiftDate(to, 1);
  const previousFrom = shiftDate(from, -days);
  const [bounds, previousBounds] = await Promise.all([
    sql`select (${from}::date::timestamp at time zone ${timezone}) as start, (${exclusiveTo}::date::timestamp at time zone ${timezone}) as "end"`,
    sql`select (${previousFrom}::date::timestamp at time zone ${timezone}) as start, (${from}::date::timestamp at time zone ${timezone}) as "end"`,
  ]);
  const fromTs = bounds[0].start;
  const toExclusive = bounds[0].end;
  const previousStart = previousBounds[0].start;
  const previousEnd = previousBounds[0].end;
  const [totals, recentOrders, lowStockProducts] = await Promise.all([
    sql`select
      (select count(*)::int from orders) orders_all,
      (select count(*)::int from orders where placed_at >= ${fromTs} and placed_at < ${toExclusive}) orders_period,
      (select count(*)::int from customers) customers_all,
      (select count(*)::int from customers where created_at >= ${fromTs} and created_at < ${toExclusive}) customers_period,
      (select count(*)::int from products where is_active) products_active,
      (select count(*)::int from products where is_active and stock <= low_stock_threshold and stock > 0) low_stock,
      (select count(*)::int from products where is_active and stock = 0) out_of_stock,
      (select count(*)::int from orders where status='pending' and placed_at >= ${fromTs} and placed_at < ${toExclusive}) pending_orders,
      (select count(*)::int from page_views where created_at >= ${fromTs} and created_at < ${toExclusive}) page_views,
      (select count(distinct visitor_hash)::int from page_views where visitor_hash is not null and created_at >= ${fromTs} and created_at < ${toExclusive}) visitor_days,
      (select coalesce(sum(grand_total),0)::bigint from orders where status<>'cancelled' and placed_at >= ${fromTs} and placed_at < ${toExclusive}) gross_order_value_period,
      (select coalesce(sum(grand_total),0)::bigint from orders where payment_status='paid' and status not in ('cancelled','refunded','returned') and placed_at >= ${fromTs} and placed_at < ${toExclusive}) paid_order_value_period,
      (select coalesce(sum(grand_total),0)::bigint from orders where payment_status='paid' and status='delivered' and delivered_at >= ${fromTs} and delivered_at < ${toExclusive}) revenue_period,
      (select coalesce(sum(grand_total),0)::bigint from orders where status<>'cancelled') gross_order_value_all,
      (select coalesce(sum(grand_total),0)::bigint from orders where payment_status='paid' and status not in ('cancelled','refunded','returned')) paid_order_value_all,
      (select coalesce(sum(grand_total),0)::bigint from orders where payment_status='paid' and status='delivered') revenue_all,
      (select coalesce(sum(grand_total),0)::bigint from orders where payment_status='paid' and status='delivered' and delivered_at >= ${previousStart} and delivered_at < ${previousEnd}) revenue_previous,
      (select count(*)::int from orders where placed_at >= ${previousStart} and placed_at < ${previousEnd}) orders_previous,
      (select count(*)::int from customers where created_at >= ${previousStart} and created_at < ${previousEnd}) customers_previous
    `,
    sql`select o.id,o.order_number,o.status,o.grand_total,o.currency,o.placed_at,
      o.shipping_address->>'full_name' as customer_name from orders o order by o.placed_at desc limit 8`,
    sql`select id,name,slug,stock,low_stock_threshold from products where stock <= low_stock_threshold and is_active order by stock asc limit 8`,
  ]);
  let monthlyRevenue = [];
  let monthlyRevenueError = null;
  try {
    monthlyRevenue = await sql`with bounds as (
      select date_trunc('month', now() at time zone ${timezone}) - interval '11 months' first_month,
        date_trunc('month', now() at time zone ${timezone}) last_month
    ), months as (
      select generate_series(first_month,last_month,interval '1 month') as local_month from bounds
    ), sales as (
      select date_trunc('month',o.delivered_at at time zone ${timezone}) as local_month,
        coalesce(sum(o.grand_total),0)::bigint revenue,
        count(*)::int deliveries
      from orders o cross join bounds b
      where o.payment_status='paid' and o.status='delivered'
        and o.delivered_at >= (b.first_month at time zone ${timezone})
        and o.delivered_at < ((b.last_month + interval '1 month') at time zone ${timezone})
      group by 1
    )
    select to_char(m.local_month,'YYYY-MM') as month,to_char(m.local_month,'Mon') as label,
      coalesce(s.revenue,0)::bigint revenue,coalesce(s.deliveries,0)::int deliveries
    from months m left join sales s using(local_month) order by m.local_month`;
  } catch (error) {
    monthlyRevenueError = 'Monthly revenue could not be loaded from the database. Retry the dashboard request.';
    console.error('Admin monthly revenue aggregation failed:', error?.message || 'unknown error');
  }
  const row = totals[0] || {};
  const revenue = num(row.revenue_period);
  const ordersPeriod = num(row.orders_period);
  const customersPeriod = num(row.customers_period);
  return {
    from, to, days, preset: period.preset, timezone,
    totals: {
      revenue, revenueAll: num(row.revenue_all), revenueGrowth: percentChange(revenue,num(row.revenue_previous)),
      grossOrderValue: num(row.gross_order_value_period), paidOrderValue: num(row.paid_order_value_period),
      grossOrderValueAll: num(row.gross_order_value_all), paidOrderValueAll: num(row.paid_order_value_all),
      orders: num(row.orders_all), ordersPeriod, customers: num(row.customers_all), customersPeriod,
      products: num(row.products_active), lowStock: num(row.low_stock), outOfStock: num(row.out_of_stock),
      pendingOrders: num(row.pending_orders), pageViews: num(row.page_views), visitorDays: num(row.visitor_days),
      // Conversion is intentionally unavailable: daily visitor hashes cannot be reliably tied to purchases.
      conversionRate: null,
    },
    recentOrders: recentOrders.map((order)=>({...order,grand_total:num(order.grand_total)})),
    monthlyRevenue: monthlyRevenue.map((row)=>({...row,revenue:num(row.revenue),deliveries:num(row.deliveries)})),
    monthlyRevenueError,
    lowStockProducts,
    notes: { revenue:'Paid delivered order value by delivery date in base currency; returned, cancelled, unpaid and refunded orders are excluded. Returns remove that order from recognized revenue.', visitors:'Counts are visitor-days from daily-rotating hashes, not deduplicated people.' },
  };
}
