import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Everything here is computed from live database rows — no hardcoded figures.
 * `range` accepts 7 | 30 | 90 | 365 days.
 */
export async function GET(request) {
  const { error, status } = await guard('dashboard:read');
  if (error) return fail(error, status);

  const range = Math.min(Math.max(Number(new URL(request.url).searchParams.get('range') || 30), 7), 365);

  const [totals, statusCounts, series, topProducts, topCategories, recentOrders, lowStock, visitorsDaily, customersDaily, coupons, paymentMix, repeat] = await Promise.all([
    sql`
      select
        (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled')
          and placed_at >= now() - (${range} || ' days')::interval) as revenue_range,
        (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled')) as revenue_all,
        (select count(*)::int from orders) as orders_all,
        (select count(*)::int from orders where placed_at >= now() - (${range} || ' days')::interval) as orders_range,
        (select count(*)::int from customers) as customers_all,
        (select count(*)::int from customers where created_at >= now() - (${range} || ' days')::interval) as customers_range,
        (select count(*)::int from products where is_active) as products_active,
        (select count(*)::int from products where stock <= low_stock_threshold and is_active) as low_stock,
        (select count(*)::int from products where stock = 0 and is_active) as out_of_stock,
        (select count(*)::int from product_variants) as variants,
        (select count(*)::int from reviews) as reviews_all,
        (select count(*)::int from reviews where not is_approved) as reviews_pending,
        (select count(*)::int from page_views where created_at >= now() - (${range} || ' days')::interval) as views_range,
        (select count(distinct visitor_id)::int from page_views where created_at >= now() - (${range} || ' days')::interval) as visitors_range,
        (select coalesce(avg(grand_total),0)::bigint from orders where status not in ('cancelled') and placed_at >= now() - (${range} || ' days')::interval) as aov,
        (select count(*)::int from email_logs where status = 'failed') as email_failures
    `,
    sql`select status, count(*)::int n, coalesce(sum(grand_total),0)::bigint value from orders group by status`,
    sql`
      with days as (
        select generate_series(current_date - (${range - 1} || ' days')::interval, current_date, '1 day')::date as d
      )
      select d::text as date,
        coalesce((select sum(grand_total) from orders o where o.placed_at::date = d and o.status not in ('cancelled')),0)::bigint as revenue,
        coalesce((select count(*) from orders o where o.placed_at::date = d),0)::int as orders,
        coalesce((select count(*) from customers c where c.created_at::date = d),0)::int as customers,
        coalesce((select count(distinct visitor_id) from page_views p where p.created_at::date = d),0)::int as visitors
      from days order by d
    `,
    sql`
      select oi.product_id, oi.name, coalesce(oi.image_url,'') as image, sum(oi.qty)::int as units,
        sum(oi.line_total)::bigint as revenue
      from order_items oi join orders o on o.id = oi.order_id
      where o.status not in ('cancelled')
      group by oi.product_id, oi.name, oi.image_url order by revenue desc limit 6
    `,
    sql`
      select c.name, coalesce(sum(oi.line_total),0)::bigint as revenue, count(distinct o.id)::int as orders
      from order_items oi join orders o on o.id = oi.order_id
      join products p on p.id = oi.product_id left join categories c on c.id = p.category_id
      where o.status not in ('cancelled') group by c.name order by revenue desc limit 8
    `,
    sql`select o.id, o.order_number, o.status, o.grand_total, o.currency, o.placed_at, o.email, o.shipping_address->>'full_name' as customer_name
        from orders o order by o.placed_at desc limit 8`,
    sql`select id, name, slug, stock, low_stock_threshold from products where stock <= low_stock_threshold and is_active order by stock asc limit 6`,
    sql`select created_at::date::text as date, count(*)::int n, count(distinct visitor_id)::int visitors from page_views
        where created_at >= now() - (${range} || ' days')::interval group by 1 order by 1`,
    sql`select created_at::date::text as date, count(*)::int n from customers
        where created_at >= now() - (${range} || ' days')::interval group by 1 order by 1`,
    sql`select code, used_count, usage_limit, is_active from coupons order by used_count desc limit 6`,
    sql`select payment_method, count(*)::int n, coalesce(sum(grand_total),0)::bigint value from orders group by payment_method order by n desc`,
    sql`select
        (select count(*)::int from customers c where (select count(*) from orders o where o.customer_id = c.id) > 1) as returning_customers,
        (select count(*)::int from customers) as total_customers`,
  ]);

  const t = totals[0];
  return json({
    range,
    totals: {
      revenue: Number(t.revenue_range),
      revenueAll: Number(t.revenue_all),
      orders: t.orders_all,
      ordersRange: t.orders_range,
      customers: t.customers_all,
      customersRange: t.customers_range,
      products: t.products_active,
      lowStock: t.low_stock,
      outOfStock: t.out_of_stock,
      variants: t.variants,
      reviews: t.reviews_all,
      reviewsPending: t.reviews_pending,
      views: t.views_range,
      visitors: t.visitors_range,
      aov: Number(t.aov),
      emailFailures: t.email_failures,
      conversion: t.visitors_range ? Number(((t.orders_range / t.visitors_range) * 100).toFixed(2)) : 0,
      returningRate: repeat[0].total_customers ? Number(((repeat[0].returning_customers / repeat[0].total_customers) * 100).toFixed(1)) : 0,
    },
    statusCounts,
    series,
    topProducts,
    topCategories,
    recentOrders,
    lowStockProducts: lowStock,
    visitorsDaily,
    customersDaily,
    coupons,
    paymentMix,
  });
}
