import { sql } from '@/lib/db';
import { getSetting } from '@/lib/settings';

const DAY_MS = 86_400_000;
const VALID_BUCKETS = new Set(['hour', 'day', 'week', 'month', 'quarter', 'year']);
const INTERVALS = { hour: '1 hour', day: '1 day', week: '1 week', month: '1 month', quarter: '3 months', year: '1 year' };
const dateOnly = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
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
const deliveredCte = (range, where) => sql`
  with delivered as (
    select o.id,o.customer_id,o.status,o.payment_status,o.payment_method,o.grand_total,o.discount_total,o.coupon_code,o.placed_at,o.delivered_at,o.currency,o.order_number
    from orders o where o.delivered_at >= ${range.start}::timestamptz and o.delivered_at < ${range.end}::timestamptz
      and o.status='delivered' and o.payment_status='paid' ${where}
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

  const [summary, seriesRows, statusRows, paymentRows, productRows, categoryRows, campaignRows, customerRows, customerPurchaseTypes, trafficRows, events, eventConversion, recentTraffic, inventoryRows, recentOrders, couponRows, comparison, filterOptions, hourRows, weekdayRows, liveSessions, productActivity] = await Promise.all([
    sql`${filteredCte(range, where)}
      select count(*)::int orders,
        count(*) filter(where payment_status='paid' and status not in ('cancelled','refunded','returned'))::int paid_orders,
        coalesce(sum(grand_total) filter(where status<>'cancelled'),0)::bigint gross_order_value,
        coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded','returned')),0)::bigint paid_order_value,
        (select coalesce(sum(o.grand_total),0)::bigint from orders o where o.delivered_at >= ${range.start}::timestamptz and o.delivered_at < ${range.end}::timestamptz and o.status='delivered' and o.payment_status='paid' ${where})::bigint revenue,
        coalesce(sum(grand_total) filter(where payment_status<>'paid' and status<>'cancelled'),0)::bigint outstanding,
        coalesce(sum(discount_total) filter(where status<>'cancelled'),0)::bigint discounts,
        count(*) filter(where status='delivered')::int delivered,
        count(*) filter(where status='cancelled')::int cancelled,
        count(*) filter(where status='refunded')::int refunded,
        count(*) filter(where status='returned')::int returned,
        (select coalesce(avg(o.grand_total),0)::bigint from orders o where o.delivered_at >= ${range.start}::timestamptz and o.delivered_at < ${range.end}::timestamptz and o.status='delivered' and o.payment_status='paid' ${where})::bigint aov,
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
          count(*) filter(where payment_status='paid' and status not in ('cancelled','refunded','returned'))::int paid_orders,
          coalesce(sum(grand_total) filter(where status<>'cancelled'),0)::bigint gross_order_value,
          coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded','returned')),0)::bigint paid_order_value,
          coalesce(sum(discount_total) filter(where status<>'cancelled'),0)::bigint discounts,
          coalesce(avg(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded')),0)::bigint average_order_value,
          count(*) filter(where status='pending')::int pending_orders,
          count(*) filter(where status='confirmed')::int confirmed_orders,
          count(*) filter(where status='processing')::int processing_orders,
          count(*) filter(where status='packed')::int packed_orders,
          count(*) filter(where status='shipped')::int shipped_orders,
          count(*) filter(where status='out_for_delivery')::int out_for_delivery_orders,
          count(*) filter(where status='delivered')::int delivered_orders,
          count(*) filter(where status='cancelled')::int cancelled_orders,
          count(*) filter(where status='returned')::int returned_orders,
          count(*) filter(where payment_status<>'paid' and status not in ('cancelled','refunded'))::int unpaid_orders,
          coalesce(sum((select sum(oi.qty) from order_items oi left join products p on p.id=oi.product_id where oi.order_id=filtered.id
            and (${product}::text is null or oi.product_id::text=${product})
            and (${category}::text is null or p.category_id::text=${category}))) filter(where status not in ('cancelled','refunded')),0)::bigint units
        from filtered group by 1
      ), delivery_agg as (
        select date_trunc(${bucket},o.delivered_at at time zone ${timezone}) local_bucket,
          coalesce(sum(o.grand_total),0)::bigint revenue,coalesce(sum(o.discount_total),0)::bigint discounts,
          coalesce(avg(o.grand_total),0)::bigint average_order_value
        from orders o where o.delivered_at >= ${range.start}::timestamptz and o.delivered_at < ${range.end}::timestamptz
          and o.status='delivered' and o.payment_status='paid' ${where} group by 1
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
      ), auth_activity as (
        select date_trunc(${bucket}, created_at at time zone ${timezone}) local_bucket,
          count(*) filter(where subject_type='customer')::int customer_sessions,
          count(*) filter(where subject_type='admin')::int admin_sessions
        from sessions where created_at >= ${range.start}::timestamptz and created_at < ${range.end}::timestamptz group by 1
      ), stock_activity as (
        select date_trunc(${bucket}, sa.created_at at time zone ${timezone}) local_bucket,coalesce(sum(sa.delta),0)::int stock_delta
        from stock_adjustments sa left join products sp on sp.id=sa.product_id
        where sa.created_at >= ${range.start}::timestamptz and sa.created_at < ${range.end}::timestamptz
          and (${product}::text is null or sa.product_id::text=${product})
          and (${category}::text is null or sp.category_id::text=${category}) group by 1
      )
      select to_char(b.local_bucket, 'YYYY-MM-DD"T"HH24:MI:SS') as date,
        coalesce(a.orders,0)::int orders, coalesce(a.paid_orders,0)::int paid_orders,
        coalesce(a.unpaid_orders,0)::int unpaid_orders,
        coalesce(a.pending_orders,0)::int pending_orders,coalesce(a.confirmed_orders,0)::int confirmed_orders,
        coalesce(a.processing_orders,0)::int processing_orders,coalesce(a.packed_orders,0)::int packed_orders,
        coalesce(a.shipped_orders,0)::int shipped_orders,coalesce(a.out_for_delivery_orders,0)::int out_for_delivery_orders,
        coalesce(a.delivered_orders,0)::int delivered_orders,coalesce(a.cancelled_orders,0)::int cancelled_orders,coalesce(a.returned_orders,0)::int returned_orders,
        coalesce(d.average_order_value,0)::bigint average_order_value,
        coalesce(d.revenue,0)::bigint revenue,coalesce(a.gross_order_value,0)::bigint gross_order_value,coalesce(a.paid_order_value,0)::bigint paid_order_value,
        coalesce(d.discounts,0)::bigint discounts,
        coalesce(a.units,0)::bigint units, coalesce(v.page_views,0)::int page_views,
        coalesce(v.visitor_days,0)::int visitor_days, coalesce(c.new_customers,0)::int new_customers,
        coalesce(bt.new_purchasers,0)::int new_purchasers, coalesce(bt.returning_purchasers,0)::int returning_purchasers,
        coalesce(aa.customer_sessions,0)::int customer_sessions,coalesce(aa.admin_sessions,0)::int admin_sessions,
        coalesce(sa.stock_delta,0)::int stock_delta
      from buckets b left join aggregated a using(local_bucket) left join delivery_agg d using(local_bucket) left join visitors v using(local_bucket)
        left join signups c using(local_bucket) left join buyer_types bt using(local_bucket)
        left join auth_activity aa using(local_bucket) left join stock_activity sa using(local_bucket)
      order by b.local_bucket`,
    sql`${filteredCte(range, where)} select status, count(*)::int orders, coalesce(sum(grand_total),0)::bigint value from filtered group by status order by status`,
    sql`${filteredCte(range, where)} select payment_method as name, count(*)::int orders,
      coalesce(sum(grand_total) filter(where payment_status='paid' and status not in ('cancelled','refunded','returned')),0)::bigint revenue,
      coalesce(sum(grand_total) filter(where payment_status<>'paid' and status not in ('cancelled','refunded','returned')),0)::bigint outstanding
      from filtered group by payment_method order by revenue desc`,
    sql`${deliveredCte(range, where)} select coalesce(oi.product_id::text, 'deleted') product_id, oi.name, sum(oi.qty)::bigint units,
      coalesce(sum(oi.line_total),0)::bigint revenue
      from delivered f join order_items oi on oi.order_id=f.id left join products p on p.id=oi.product_id
      where f.status='delivered' and f.payment_status='paid'
        and (${product}::text is null or oi.product_id::text=${product}) and (${category}::text is null or p.category_id::text=${category})
      group by oi.product_id, oi.name order by revenue desc, units desc limit 20`,
    sql`${deliveredCte(range, where)} select coalesce(c.name,'Uncategorised') name, sum(oi.qty)::bigint units,
      coalesce(sum(oi.line_total),0)::bigint revenue, count(distinct f.id)::int orders
      from delivered f join order_items oi on oi.order_id=f.id left join products p on p.id=oi.product_id left join categories c on c.id=p.category_id
      where f.status='delivered' and f.payment_status='paid'
        and (${product}::text is null or oi.product_id::text=${product}) and (${category}::text is null or p.category_id::text=${category})
      group by c.name order by revenue desc limit 20`,
    sql`${deliveredCte(range, where)} select coalesce(coupon_code,'No coupon') name, count(*)::int orders,
      coalesce(sum(grand_total),0)::bigint revenue,coalesce(sum(discount_total),0)::bigint discounts
      from delivered group by coupon_code order by discounts desc limit 20`,
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
      (select coalesce(sum(o.grand_total),0)::bigint from orders o where o.delivered_at >= ${prevRange.start}::timestamptz and o.delivered_at < ${prevRange.end}::timestamptz and o.status='delivered' and o.payment_status='paid' ${where})::bigint revenue
      from filtered`,
    Promise.all([
      sql`select id, name from products where is_active order by name limit 500`,
      sql`select id, name from categories where is_active order by name limit 200`,
      sql`select distinct status from orders order by status`,
      sql`select distinct payment_method from orders order by payment_method`,
    ]),
    sql`${filteredCte(range, where)}
      , hours as (select generate_series(0,23)::int as hour_of_day),
      order_hours as (select extract(hour from placed_at at time zone ${timezone})::int as hour_of_day,count(*)::int orders from filtered group by 1),
      delivery_hours as (select extract(hour from o.delivered_at at time zone ${timezone})::int as hour_of_day,coalesce(sum(o.grand_total),0)::bigint revenue
        from orders o where o.delivered_at>=${range.start}::timestamptz and o.delivered_at<${range.end}::timestamptz and o.status='delivered' and o.payment_status='paid' ${where} group by 1),
      view_hours as (select extract(hour from created_at at time zone ${timezone})::int as hour_of_day,count(*)::int page_views,count(distinct visitor_hash)::int visitor_days
        from page_views where created_at>=${range.start}::timestamptz and created_at<${range.end}::timestamptz group by 1)
      select h.hour_of_day as hour,lpad(h.hour_of_day::text,2,'0')||':00' as date,coalesce(o.orders,0)::int orders,coalesce(d.revenue,0)::bigint revenue,
        coalesce(v.page_views,0)::int page_views,coalesce(v.visitor_days,0)::int visitor_days
      from hours h left join order_hours o using(hour_of_day) left join delivery_hours d using(hour_of_day) left join view_hours v using(hour_of_day) order by h.hour_of_day`,
    sql`with weekdays as (select generate_series(1,7)::int weekday),
      order_weekdays as (select extract(isodow from placed_at at time zone ${timezone})::int weekday,count(*)::int orders from orders o
        where o.placed_at>=${range.start}::timestamptz and o.placed_at<${range.end}::timestamptz ${where} group by 1),
      delivery_weekdays as (select extract(isodow from o.delivered_at at time zone ${timezone})::int weekday,coalesce(sum(o.grand_total),0)::bigint revenue from orders o
        where o.delivered_at>=${range.start}::timestamptz and o.delivered_at<${range.end}::timestamptz and o.status='delivered' and o.payment_status='paid' ${where} group by 1)
      select w.weekday,coalesce(o.orders,0)::int orders,coalesce(d.revenue,0)::bigint revenue from weekdays w
      left join order_weekdays o using(weekday) left join delivery_weekdays d using(weekday) order by w.weekday`,
    sql`select count(*) filter(where revoked_at is null and expires_at>now())::int valid_sessions,
      count(distinct (subject_type,subject_id)) filter(where revoked_at is null and expires_at>now())::int valid_accounts,
      count(distinct subject_id) filter(where subject_type='customer' and revoked_at is null and expires_at>now())::int valid_customer_accounts,
      count(distinct subject_id) filter(where subject_type='admin' and revoked_at is null and expires_at>now())::int valid_admin_accounts
      from sessions`,
    sql`select e.product_id::text product_id,coalesce(p.name,'Deleted product') name,count(*)::int views
      from analytics_events e left join products p on p.id=e.product_id
      where e.event_type='product_view' and e.created_at >= ${range.start}::timestamptz and e.created_at < ${range.end}::timestamptz
        and (${product}::text is null or e.product_id::text=${product})
        and (${category}::text is null or p.category_id::text=${category})
      group by e.product_id,p.name order by views desc limit 20`.then(rows=>({rows,available:true})).catch(()=>({rows:[],available:false})),
  ]);
  const eventMap = Object.fromEntries(events.rows.map((r) => [r.event_type, { count: toNumber(r.count), visitors: toNumber(r.visitor_days) }]));
  const funnel = ['page_view','product_view','add_to_cart','checkout_started','purchase'].map((name) => ({ name, ...eventMap[name] || { count: 0, visitors: 0 } }));
  const visitorData = trafficRows[0] || {};
  const customerData = customerRows[0] || {};
  const customerTypes = customerPurchaseTypes[0] || {};
  const inventory = inventoryRows[0] || {};
  const counts = summary[0] || {};
  const series = seriesRows.map((r) => ({ ...r,
    revenue: toNumber(r.revenue), grossOrderValue: toNumber(r.gross_order_value), paidOrderValue: toNumber(r.paid_order_value), discounts: toNumber(r.discounts), averageOrderValue: toNumber(r.average_order_value),
    orders: toNumber(r.orders), units: toNumber(r.units), pageViews: toNumber(r.page_views), visitorDays: toNumber(r.visitor_days),
    customers: toNumber(r.new_customers), newPurchasers: toNumber(r.new_purchasers), returningPurchasers: toNumber(r.returning_purchasers),
    customerSessions: toNumber(r.customer_sessions), adminSessions: toNumber(r.admin_sessions), stockDelta: toNumber(r.stock_delta),
    paidOrders: toNumber(r.paid_orders), unpaidOrders: toNumber(r.unpaid_orders), pendingOrders: toNumber(r.pending_orders),
    confirmedOrders: toNumber(r.confirmed_orders), processingOrders: toNumber(r.processing_orders), packedOrders: toNumber(r.packed_orders),
    shippedOrders: toNumber(r.shipped_orders), outForDeliveryOrders: toNumber(r.out_for_delivery_orders), deliveredOrders: toNumber(r.delivered_orders),
    cancelledOrders: toNumber(r.cancelled_orders), returnedOrders: toNumber(r.returned_orders),
  }));
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
  const productPerformanceMap = new Map(productRows.map((row) => [row.product_id, {
    product_id: row.product_id, name: row.name, date: row.name,
    units: toNumber(row.units), revenue: toNumber(row.revenue), views: 0,
  }]));
  for (const row of productActivity.rows) {
    const current = productPerformanceMap.get(row.product_id) || { product_id: row.product_id, name: row.name, date: row.name, units: 0, revenue: 0, views: 0 };
    current.views = toNumber(row.views);
    productPerformanceMap.set(row.product_id, current);
  }
  const productPerformance = [...productPerformanceMap.values()].sort((a,b)=>b.views-a.views||b.units-a.units).slice(0,20);
  return {
    range: { ...range },
    liveSessions: {
      validSessions: toNumber(liveSessions[0]?.valid_sessions),
      validAccounts: toNumber(liveSessions[0]?.valid_accounts),
      validCustomerAccounts: toNumber(liveSessions[0]?.valid_customer_accounts),
      validAdminAccounts: toNumber(liveSessions[0]?.valid_admin_accounts),
      measuredAt: new Date().toISOString(),
    },
    totals: {
      orders: totalOrders, revenue: toNumber(counts.revenue), deliveredPaidRevenue: toNumber(counts.revenue),
      grossOrderValue: toNumber(counts.gross_order_value), paidOrderValue: toNumber(counts.paid_order_value), grossPaid: toNumber(counts.paid_order_value),
      refundedAmount: null, outstanding, discounts: toNumber(counts.discounts), delivered: toNumber(counts.delivered), paidOrders,
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
    productPerformance, productViewTrackingAvailable: productActivity.available,
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
      revenue: 'Revenue is recognized paid delivered order value grouped by delivery timestamp and store timezone; cancelled, returned, refunded-status and unpaid orders are excluded. Gross placed order value and paid order value are separate order-date cohort measures. Actual refunded currency is unavailable because no refund ledger exists.',
      visitors: 'Visitor counts are distinct daily-rotating anonymous hashes (visitor-days), not deduplicated people or sessions. Historical visitor data only starts when instrumentation recorded it.',
      liveSessions: 'The live count is distinct accounts with non-revoked, unexpired login sessions at query time. It is not a real-time activity/presence signal; the schema does not record last activity.',
      loginHistory: 'Historical customer/admin login counts are sessions created in each time bucket, not unique active users.',
      inventory: 'Historical inventory values cannot be reconstructed because the application stores stock adjustments but no opening-balance snapshots; stock delta uses recorded adjustments only.',
      conversion: 'Where event tracking exists, observed same-day visitor-day purchase share is calculated from daily-rotating hashes with both page_view and purchase events; it is a proxy, not a session-level or cross-day conversion rate.',
      delivery: 'Delivery duration is measured from order placed_at to delivered_at when both timestamps exist.',
      payments: 'The schema has no payment-attempt or settlement ledger/timestamp, so processor payment success rate and exact payment time are unavailable. Paid-order share is not a payment success rate.',
      customers: 'New and returning order segments use registered customer IDs and first non-cancelled recorded order. Unpaid orders are included as placed orders; guest orders cannot be reliably deduplicated as customers.',
      scope: 'Aggregates scan matching records without truncation. Recent order activity is limited to 12 rows.',
    },
  };
}
