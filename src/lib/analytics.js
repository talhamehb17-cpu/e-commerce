import { sql } from '@/lib/db';
import { getSetting } from '@/lib/settings';

const DAY_MS = 86_400_000;
const VALID_BUCKETS = new Set(['hour', 'day', 'week', 'month', 'quarter', 'year']);
const INTERVALS = { hour: '1 hour', day: '1 day', week: '1 week', month: '1 month', quarter: '3 months', year: '1 year' };
const dateOnly = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const moveDate = (date, offset) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
const partsInZone = (date, zone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
const dateInZone = (date, zone) => {
  const p = partsInZone(date, zone);
  return `${p.year}-${p.month}-${p.day}`;
};
const toNumber = (v) => Number(v || 0);
const isPaid = (status) => status === 'paid';

function datePreset(params, zone) {
  const today = dateInZone(new Date(), zone);
  const fromParam = params.get('from');
  const toParam = params.get('to');
  if (fromParam || toParam) {
    if (!dateOnly(fromParam) || !dateOnly(toParam) || fromParam > toParam) throw new Error('Choose valid start and end dates.');
    const length = (Date.parse(`${toParam}T00:00:00Z`) - Date.parse(`${fromParam}T00:00:00Z`)) / DAY_MS + 1;
    const maxDays = ['month','quarter','year'].includes(params.get('view')) ? 3660 : 366;
    if (length > maxDays) throw new Error(`Choose a date range of no more than ${maxDays} days for this grouping.`);
    return { from: fromParam, to: toParam, days: length, preset: 'custom' };
  }
  const date = params.get('date');
  if (date) {
    if (!dateOnly(date)) throw new Error('Choose a valid date.');
    return { from: date, to: date, days: 1, preset: 'date' };
  }
  const month = params.get('month');
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.');
    const [year, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const last = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
    return { from, to: last, days: new Date(Date.UTC(year, m, 0)).getUTCDate(), preset: 'month' };
  }
  const kind = params.get('preset');
  if (kind === 'today') return { from: today, to: today, days: 1, preset: kind };
  if (kind === 'yesterday') { const d = moveDate(today, -1); return { from: d, to: d, days: 1, preset: kind }; }
  if (kind === 'this-week' || kind === 'previous-week') {
    const d = new Date(`${today}T00:00:00Z`);
    const mondayOffset = (d.getUTCDay() + 6) % 7;
    const thisMonday = moveDate(today, -mondayOffset);
    const from = kind === 'this-week' ? thisMonday : moveDate(thisMonday, -7);
    const to = kind === 'this-week' ? today : moveDate(thisMonday, -1);
    return { from, to, days: (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1, preset: kind };
  }
  if (kind === 'this-month' || kind === 'previous-month') {
    const [year, m] = today.split('-').map(Number);
    const thisStart = `${year}-${String(m).padStart(2, '0')}-01`;
    if (kind === 'this-month') return { from: thisStart, to: today, days: Number(today.slice(-2)), preset: kind };
    const prevStart = moveDate(thisStart, -1);
    const prevEnd = moveDate(thisStart, -1);
    return { from: prevStart.slice(0, 8) + '01', to: prevEnd, days: Number(prevEnd.slice(-2)), preset: kind };
  }
  const daysRaw = Number(params.get('days') || (kind === 'last-7' ? 7 : kind === 'last-90' ? 90 : kind === 'last-365' ? 365 : 30));
  const days = [7, 30, 90, 365].includes(daysRaw) ? daysRaw : 30;
  return { from: moveDate(today, -(days - 1)), to: today, days, preset: `last-${days}` };
}

function filteredWhere({ status, payment, campaign, product, category }) {
  return sql`
    and (${status}::text is null or o.status = ${status})
    and (${payment}::text is null or o.payment_method = ${payment})
    and (${campaign}::text is null or o.coupon_code = ${campaign})
    and (${product}::text is null or exists (select 1 from order_items fpoi where fpoi.order_id=o.id and fpoi.product_id::text=${product}))
    and (${category}::text is null or exists (select 1 from order_items fcoi join products fcp on fcp.id=fcoi.product_id where fcoi.order_id=o.id and fcp.category_id::text=${category}))
  `;
}

const filteredCte = (range, where) => sql`
  with filtered as (
    select o.id, o.customer_id, o.status, o.payment_status, o.payment_method, o.grand_total,
      o.discount_total, o.coupon_code, o.placed_at, o.delivered_at, o.currency, o.order_number
    from orders o where o.placed_at >= ${range.start}::timestamptz and o.placed_at < ${range.end}::timestamptz ${where}
  )
`;

/**
 * Date boundaries are local calendar dates in the configured IANA store timezone;
 * PostgreSQL converts those boundaries to instants. All money values are the schema's
 * base-currency minor units (`orders.grand_total`), not transaction `display_total`.
 */
export async function getAnalytics(params) {
  const store = await getSetting('store');
  let timezone = typeof store.timezone === 'string' ? store.timezone : 'Asia/Karachi';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { timezone = 'Asia/Karachi'; }
  const requested = datePreset(params, timezone);
  const bucket = VALID_BUCKETS.has(params.get('view')) ? params.get('view') : (requested.days === 1 ? 'hour' : requested.days > 90 ? 'month' : 'day');
  if (bucket === 'hour' && requested.days > 31) throw new Error('Hourly grouping is limited to 31 days. Choose a shorter period or use daily/monthly grouping.');
  const toExclusiveDate = moveDate(requested.to, 1);
  const boundaries = await sql`
    select (${requested.from}::date::timestamp at time zone ${timezone}) as start,
      (${toExclusiveDate}::date::timestamp at time zone ${timezone}) as "end"
  `;
  const range = { ...requested, start: new Date(boundaries[0].start).toISOString(), end: new Date(boundaries[0].end).toISOString(), timezone, bucket };
  const status = params.get('status') || null;
  const payment = params.get('payment') || null;
  const product = params.get('product') || null;
  const category = params.get('category') || null;
  const campaign = params.get('campaign') || null;
  const where = filteredWhere({ status, payment, product, category, campaign });
  const previousFrom = moveDate(requested.from, -requested.days);
  const previousTo = moveDate(requested.from, -1);
  const previousBounds = await sql`
    select (${previousFrom}::date::timestamp at time zone ${timezone}) as start,
      (${requested.from}::date::timestamp at time zone ${timezone}) as "end"
  `;
  const prevRange = { start: new Date(previousBounds[0].start).toISOString(), end: new Date(previousBounds[0].end).toISOString() };
  const interval = INTERVALS[bucket];
  const bucketedSeries = filteredCte(range, where);

  const [summary, seriesRows, statusRows, paymentRows, productRows, categoryRows, campaignRows, customerRows, customerPurchaseTypes, trafficRows, events, eventConversion, recentTraffic, inventoryRows, recentOrders, couponRows, comparison, filterOptions, hourRows, weekdayRows] = await Promise.all([
    sql`${filteredCte(range, where)}
      select count(*)::int orders,
        count(*) filter(where payment_status='paid' and status not in ('cancelled','refunded'))::int paid_orders,
        coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue,
        coalesce(sum(grand_total) filter(where payment_status<>'paid' and status not in ('cancelled','refunded')),0)::bigint outstanding,
        coalesce(sum(discount_total),0)::bigint discounts,
        count(*) filter(where status='delivered')::int delivered,
        count(*) filter(where status='cancelled')::int cancelled,
        count(*) filter(where status='refunded')::int refunded,
        count(*) filter(where status='returned')::int returned,
        coalesce(avg(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint aov,
        count(distinct customer_id) filter(where customer_id is not null and status not in ('cancelled','refunded'))::int purchasing_customers,
        count(*) filter(where delivered_at is not null)::int with_delivery_time,
        coalesce(avg(extract(epoch from (delivered_at-placed_at))) filter(where delivered_at is not null and delivered_at>=placed_at),0)::numeric avg_delivery_seconds
      from filtered`,
    sql`${bucketedSeries}
      , buckets as (
        select generate_series(date_trunc(${bucket}, ${requested.from}::timestamp),
          date_trunc(${bucket}, ${toExclusiveDate}::date::timestamp - interval '1 microsecond'), ${interval}::interval) as local_bucket
      ), aggregated as (
        select date_trunc(${bucket}, placed_at at time zone ${timezone}) local_bucket,
          count(*)::int orders,
          count(*) filter(where payment_status='paid' and status not in ('cancelled','refunded'))::int paid_orders,
          coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue,
          coalesce(sum(discount_total),0)::bigint discounts,
          coalesce(sum((select sum(oi.qty) from order_items oi left join products p on p.id=oi.product_id where oi.order_id=filtered.id
            and (${product}::text is null or oi.product_id::text=${product})
            and (${category}::text is null or p.category_id::text=${category}))) filter(where status not in ('cancelled','refunded')),0)::bigint units
        from filtered group by 1
      ), visitors as (
        select date_trunc(${bucket}, created_at at time zone ${timezone}) local_bucket,
          count(*)::int page_views, count(distinct visitor_hash)::int visitor_days
        from page_views where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz group by 1
      ), signups as (
        select date_trunc(${bucket}, created_at at time zone ${timezone}) local_bucket, count(*)::int new_customers
        from customers where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz group by 1
      ), buyer_types as (
        select date_trunc(${bucket}, f.placed_at at time zone ${timezone}) local_bucket,
          count(distinct f.customer_id) filter(where f.customer_id is not null and f.placed_at <= (select min(old.placed_at) from orders old where old.customer_id=f.customer_id and old.status not in ('cancelled','refunded')))::int new_purchasers,
          count(distinct f.customer_id) filter(where f.customer_id is not null and f.placed_at > (select min(old.placed_at) from orders old where old.customer_id=f.customer_id and old.status not in ('cancelled','refunded')))::int returning_purchasers
        from filtered f where f.status not in ('cancelled','refunded') group by 1
      )
      select to_char(b.local_bucket, 'YYYY-MM-DD"T"HH24:MI:SS') as date,
        coalesce(a.orders,0)::int orders, coalesce(a.paid_orders,0)::int paid_orders,
        coalesce(a.revenue,0)::bigint revenue, coalesce(a.discounts,0)::bigint discounts,
        coalesce(a.units,0)::bigint units, coalesce(v.page_views,0)::int page_views,
        coalesce(v.visitor_days,0)::int visitor_days, coalesce(c.new_customers,0)::int new_customers,
        coalesce(bt.new_purchasers,0)::int new_purchasers, coalesce(bt.returning_purchasers,0)::int returning_purchasers
      from buckets b left join aggregated a using(local_bucket) left join visitors v using(local_bucket) left join signups c using(local_bucket) left join buyer_types bt using(local_bucket)
      order by b.local_bucket`,
    sql`${filteredCte(range, where)} select status, count(*)::int orders, coalesce(sum(grand_total),0)::bigint value from filtered group by status order by status`,
    sql`${filteredCte(range, where)} select payment_method as name, count(*)::int orders,
      coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue,
      coalesce(sum(grand_total) filter(where payment_status<>'paid' and status not in ('cancelled','refunded')),0)::bigint outstanding
      from filtered group by payment_method order by revenue desc`,
    sql`${filteredCte(range, where)} select coalesce(oi.product_id::text, 'deleted') product_id, oi.name, sum(oi.qty)::bigint units,
      coalesce(sum(oi.line_total) filter(where f.payment_status='paid'),0)::bigint revenue
      from filtered f join order_items oi on oi.order_id=f.id left join products p on p.id=oi.product_id
      where f.status not in ('cancelled','refunded')
        and (${product}::text is null or oi.product_id::text=${product}) and (${category}::text is null or p.category_id::text=${category})
      group by oi.product_id, oi.name order by revenue desc, units desc limit 20`,
    sql`${filteredCte(range, where)} select coalesce(c.name,'Uncategorised') name, sum(oi.qty)::bigint units,
      coalesce(sum(oi.line_total) filter(where f.payment_status='paid'),0)::bigint revenue, count(distinct f.id)::int orders
      from filtered f join order_items oi on oi.order_id=f.id left join products p on p.id=oi.product_id left join categories c on c.id=p.category_id
      where f.status not in ('cancelled','refunded')
        and (${product}::text is null or oi.product_id::text=${product}) and (${category}::text is null or p.category_id::text=${category})
      group by c.name order by revenue desc limit 20`,
    sql`${filteredCte(range, where)} select coalesce(coupon_code,'No coupon') name, count(*)::int orders,
      coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue,
      coalesce(sum(discount_total),0)::bigint discounts from filtered group by coupon_code order by discounts desc limit 20`,
    sql`select count(*)::int total,
      count(*) filter(where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz)::int new_count,
      count(*) filter(where marketing_opt_in)::int opted_in from customers`,
    sql`${filteredCte(range, where)}
      , period_customers as (select customer_id, count(*)::int order_count from filtered where customer_id is not null and status not in ('cancelled','refunded') group by customer_id),
      first_purchase as (select customer_id, min(placed_at) first_order from orders where customer_id is not null and status not in ('cancelled','refunded') group by customer_id)
      select count(*)::int purchasing,
        count(*) filter(where pc.order_count > 1)::int repeat_in_range,
        count(*) filter(where fp.first_order >= ${range.start}::timestamptz and fp.first_order < ${range.end}::timestamptz)::int new_purchasers,
        count(*) filter(where fp.first_order < ${range.start}::timestamptz)::int returning_purchasers
      from period_customers pc join first_purchase fp using(customer_id)`,
    sql`select count(*)::int page_views, count(distinct visitor_hash)::int visitor_days,
      count(distinct visitor_hash) filter(where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz)::int visitors_in_period
      from page_views where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz`,
    sql`select event_type, count(*)::int count, count(distinct visitor_hash)::int visitor_days
      from analytics_events where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz group by event_type`.then(rows => ({ rows, available: true })).catch(() => ({ rows: [], available: false })),
    sql`with page_visitors as (select distinct visitor_hash from analytics_events where event_type='page_view' and created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz),
      buyers as (select distinct visitor_hash from analytics_events where event_type='purchase' and created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz)
      select count(*)::int page_visitors, count(*) filter(where b.visitor_hash is not null)::int buying_visitor_days from page_visitors p left join buyers b using(visitor_hash)`
      .then(rows => ({ row: rows[0], available: true })).catch(() => ({ row: null, available: false })),
    sql`select path, referrer, created_at from page_views order by created_at desc limit 12`,
    sql`select count(*)::int products, count(*) filter(where is_active)::int active,
      count(*) filter(where is_active and stock > 0 and stock <= low_stock_threshold)::int low_stock,
      count(*) filter(where is_active and stock = 0)::int out_of_stock,
      count(*) filter(where is_active and stock > low_stock_threshold)::int healthy,
      coalesce(sum(stock) filter(where is_active),0)::bigint units from products`,
    sql`${filteredCte(range, where)} select f.id, f.order_number, f.status, f.payment_status, f.payment_method, f.grand_total, f.currency, f.placed_at,
      f.delivered_at, f.customer_id, f.coupon_code, o.shipping_address->>'full_name' as customer_name,
      coalesce((select json_agg(json_build_object('name',oi.name,'qty',oi.qty)) from order_items oi where oi.order_id=f.id),'[]'::json) items
      from filtered f join orders o on o.id=f.id order by f.placed_at desc limit 12`,
    sql`select code from (select code from coupons union select distinct coupon_code as code from orders where coupon_code is not null and placed_at >= ${range.start}::timestamptz and placed_at < ${range.end}::timestamptz) c order by code limit 200`,
    sql`${filteredCte(prevRange, where)} select count(*)::int orders,
      coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue
      from filtered`,
    Promise.all([
      sql`select id, name from products where is_active order by name limit 500`,
      sql`select id, name from categories where is_active order by name limit 200`,
      sql`select distinct status from orders order by status`,
      sql`select distinct payment_method from orders order by payment_method`,
    ]),
    sql`${filteredCte(range, where)}
      , hours as (select generate_series(0,23)::int as hour_of_day),
      order_hours as (select extract(hour from placed_at at time zone ${timezone})::int as hour_of_day, count(*)::int orders,
        coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue
        from filtered group by 1),
      view_hours as (select extract(hour from created_at at time zone ${timezone})::int as hour_of_day, count(*)::int page_views,
        count(distinct visitor_hash)::int visitor_days from page_views where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz group by 1)
      select h.hour_of_day as hour, lpad(h.hour_of_day::text,2,'0')||':00' as date, coalesce(o.orders,0)::int orders, coalesce(o.revenue,0)::bigint revenue,
        coalesce(v.page_views,0)::int page_views, coalesce(v.visitor_days,0)::int visitor_days
      from hours h left join order_hours o using(hour_of_day) left join view_hours v using(hour_of_day) order by h.hour_of_day`,
    sql`${filteredCte(range, where)} select extract(isodow from placed_at at time zone ${timezone})::int weekday,
      count(*)::int orders, coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint revenue
      from filtered group by 1 order by 1`,
  ]);
  const eventMap = Object.fromEntries(events.rows.map((r) => [r.event_type, { count: toNumber(r.count), visitors: toNumber(r.visitor_days) }]));
  const funnel = ['page_view','product_view','add_to_cart','checkout_started','purchase'].map((name) => ({ name, ...eventMap[name] || { count: 0, visitors: 0 } }));
  const visitorData = trafficRows[0] || {};
  const customerData = customerRows[0] || {};
  const customerTypes = customerPurchaseTypes[0] || {};
  const inventory = inventoryRows[0] || {};
  const counts = summary[0] || {};
  const series = seriesRows.map((r) => ({ ...r, revenue: toNumber(r.revenue), orders: toNumber(r.orders), units: toNumber(r.units), pageViews: toNumber(r.page_views), visitorDays: toNumber(r.visitor_days), customers: toNumber(r.new_customers), newPurchasers: toNumber(r.new_purchasers), returningPurchasers: toNumber(r.returning_purchasers) }));
  const byHour = hourRows.map((r) => ({ ...r, hour: toNumber(r.hour), revenue: toNumber(r.revenue), orders: toNumber(r.orders), pageViews: toNumber(r.page_views), visitorDays: toNumber(r.visitor_days) }));
  const weekdayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const byWeekday = weekdayNames.map((name,index) => {
    const row = weekdayRows.find((r) => Number(r.weekday) === index + 1) || {};
    return { name, date: name, revenue: toNumber(row.revenue), orders: toNumber(row.orders) };
  });
  const outstanding = toNumber(counts.outstanding);
  const totalOrders = toNumber(counts.orders);
  const canceled = toNumber(counts.cancelled);
  const refunded = toNumber(counts.refunded);
  const returned = toNumber(counts.returned);
  const paidOrders = toNumber(counts.paid_orders);
  const denominator = totalOrders - canceled - refunded;
  const ratio = (n, d) => d > 0 ? Number((n / d * 100).toFixed(1)) : null;
  return {
    range: { ...range },
    totals: {
      orders: totalOrders, revenue: toNumber(counts.revenue), grossPaid: toNumber(counts.revenue), outstanding,
      discounts: toNumber(counts.discounts), delivered: toNumber(counts.delivered), paidOrders,
      units: series.reduce((sum, row) => sum + row.units, 0), refunds: null,
      cancelled: canceled, refunded, returned, aov: toNumber(counts.aov), purchasingCustomers: toNumber(counts.purchasing_customers),
      deliveryRate: ratio(toNumber(counts.delivered), denominator), avgDeliverySeconds: toNumber(counts.avg_delivery_seconds),
      orderCompletionRate: ratio(toNumber(counts.delivered), totalOrders), paymentSuccessRate: null,
      conversionRate: events.available && eventConversion.available ? ratio(toNumber(eventConversion.row?.buying_visitor_days), toNumber(eventConversion.row?.page_visitors)) : null,
      paidOrderShare: ratio(paidOrders, totalOrders), cancellationRate: ratio(canceled, totalOrders), refundRate: ratio(refunded, totalOrders),
      customerRetentionRate: ratio(toNumber(customerTypes.repeat_in_range), toNumber(customerTypes.purchasing)),
      returningCustomerRate: ratio(toNumber(customerTypes.returning_purchasers), toNumber(customerTypes.purchasing)),
      newCustomerRate: ratio(toNumber(customerTypes.new_purchasers), toNumber(customerTypes.purchasing)),
      campaignOrderRate: ratio(campaignRows.filter((r) => r.name !== 'No coupon').reduce((n, r) => n + toNumber(r.orders), 0), totalOrders),
    },
    series,
    byHour,
    byWeekday,
    status: statusRows.map((x) => ({ name: x.status, orders: toNumber(x.orders), value: toNumber(x.value) })),
    payments: paymentRows.map((x) => ({ ...x, orders: toNumber(x.orders), revenue: toNumber(x.revenue), outstanding: toNumber(x.outstanding) })),
    products: productRows.map((x) => ({ ...x, units: toNumber(x.units), revenue: toNumber(x.revenue) })),
    categories: categoryRows.map((x) => ({ ...x, units: toNumber(x.units), orders: toNumber(x.orders), revenue: toNumber(x.revenue) })),
    campaigns: campaignRows.map((x) => ({ ...x, orders: toNumber(x.orders), revenue: toNumber(x.revenue), discounts: toNumber(x.discounts) })),
    customers: {
      ...customerData, total: toNumber(customerData.total), new_count: toNumber(customerData.new_count),
      opted_in: toNumber(customerData.opted_in), purchasing: toNumber(counts.purchasing_customers),
      newPurchasers: toNumber(customerTypes.new_purchasers), returningPurchasers: toNumber(customerTypes.returning_purchasers),
      repeatInRange: toNumber(customerTypes.repeat_in_range),
    },
    inventory: {
      ...inventory, products: toNumber(inventory.products), active: toNumber(inventory.active),
      low_stock: toNumber(inventory.low_stock), out_of_stock: toNumber(inventory.out_of_stock),
      healthy: toNumber(inventory.healthy), units: toNumber(inventory.units),
      healthRate: ratio(toNumber(inventory.healthy), toNumber(inventory.active)),
    },
    traffic: {
      pageViews: toNumber(visitorData.page_views), visitors: toNumber(visitorData.visitor_days),
      conversion: { rate: events.available && eventConversion.available ? ratio(toNumber(eventConversion.row?.buying_visitor_days), toNumber(eventConversion.row?.page_visitors)) : null, denominator: toNumber(eventConversion.row?.page_visitors), numerator: toNumber(eventConversion.row?.buying_visitor_days) },
      funnel, eventTrackingAvailable: events.available,
      recentActivity: recentTraffic,
      historicalFunnelFrom: events.available ? 'Funnel tracking begins with current instrumentation; earlier events are unavailable.' : 'analytics_events schema is not available; funnel events are not being stored.',
    },
    recentOrders: recentOrders.map((x) => ({ ...x, grand_total: toNumber(x.grand_total) })),
    coupons: couponRows,
    filters: {
      products: filterOptions[0], categories: filterOptions[1],
      statuses: filterOptions[2].map((x) => x.status), payments: filterOptions[3].map((x) => x.payment_method),
    },
    previous: { orders: toNumber(comparison[0]?.orders), revenue: toNumber(comparison[0]?.revenue) },
    notes: {
      currency: 'Revenue uses orders.grand_total in the configured base currency minor units (PKR by default); transaction display currency is not summed.',
      revenue: 'Revenue is paid gross order value excluding cancelled/refunded statuses. There is no refund ledger, so this is not net of refunds or returns.',
      visitors: 'Visitor counts are distinct daily-rotating anonymous hashes (visitor-days), not deduplicated people or sessions.',
      conversion: 'Where event tracking exists, observed same-day visitor-day purchase share is calculated from daily-rotating hashes with both page_view and purchase events; it is a proxy, not a session-level or cross-day conversion rate.',
      delivery: 'Delivery duration is measured from order placed_at to delivered_at when both timestamps exist.',
      payments: 'The schema has no payment-attempt or settlement ledger/timestamp, so processor payment success rate and exact payment time are unavailable. Paid-order share is not a payment success rate.',
      customers: 'New and returning order segments use registered customer IDs and first non-cancelled recorded order. Unpaid orders are included as placed orders; guest orders cannot be reliably deduplicated as customers.',
      scope: 'Aggregates scan matching records without truncation. Recent order activity is limited to 12 rows.',
    },
  };
}
