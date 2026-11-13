import { sql } from '@/lib/db';
import { AdminDashboard } from '@/components/admin/dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function AdminHome() {
  // The client component refreshes itself; seed with the same shape to avoid a flash.
  const range = 30;
  const [totals, statusCounts, series, topProducts, topCategories, recentOrders, lowStock, emailFailures] = await Promise.all([
    sql`select
      (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled') and placed_at >= now() - (${range} || ' days')::interval) revenue,
      (select coalesce(sum(grand_total),0)::bigint from orders where status not in ('cancelled')) revenue_all,
      (select count(*)::int from orders) orders,
      (select count(*)::int from orders where placed_at >= now() - (${range} || ' days')::interval) orders_range,
      (select count(*)::int from customers) customers,
      (select count(*)::int from customers where created_at >= now() - (${range} || ' days')::interval) customers_range,
      (select count(*)::int from products where is_active) products,
      (select count(*)::int from products where stock <= low_stock_threshold and is_active) low_stock,
      (select count(*)::int from products where stock = 0 and is_active) out_of_stock,
      (select count(*)::int from reviews where not is_approved) reviews_pending,
      (select count(*)::int from page_views where created_at >= now() - (${range} || ' days')::interval) views,
      (select count(distinct visitor_id)::int from page_views where created_at >= now() - (${range} || ' days')::interval) visitors,
      (select coalesce(avg(grand_total),0)::bigint from orders where status not in ('cancelled')) aov,
      (select count(*)::int from email_logs where status = 'failed') email_failures`,
    sql`select status, count(*)::int n from orders group by status`,
    sql`with days as (select generate_series(current_date - (${range - 1} || ' days')::interval, current_date, '1 day')::date d)
        select d::text date,
          coalesce((select sum(grand_total) from orders o where o.placed_at::date = d and o.status not in ('cancelled')),0)::bigint revenue,
          coalesce((select count(*) from orders o where o.placed_at::date = d),0)::int orders,
          coalesce((select count(*) from customers c where c.created_at::date = d),0)::int customers,
          coalesce((select count(distinct visitor_id) from page_views p where p.created_at::date = d),0)::int visitors
        from days order by d`,
    sql`select oi.name, sum(oi.qty)::int units, sum(oi.line_total)::bigint revenue from order_items oi
        join orders o on o.id = oi.order_id where o.status not in ('cancelled') group by oi.name order by revenue desc limit 6`,
    sql`select c.name, coalesce(sum(oi.line_total),0)::bigint revenue from order_items oi
        join orders o on o.id = oi.order_id join products p on p.id = oi.product_id
        left join categories c on c.id = p.category_id where o.status not in ('cancelled')
        group by c.name order by revenue desc limit 8`,
    sql`select id, order_number, status, grand_total, placed_at, email, shipping_address->>'full_name' customer_name
        from orders order by placed_at desc limit 8`,
    sql`select id, name, stock from products where stock <= low_stock_threshold and is_active order by stock asc limit 6`,
    sql`select count(*)::int n from email_logs where status = 'failed'`,
  ]);

  const t = totals[0];
  const initial = {
    range,
    totals: {
      revenue: Number(t.revenue), revenueAll: Number(t.revenue_all), orders: t.orders, ordersRange: t.orders_range,
      customers: t.customers, customersRange: t.customers_range, products: t.products, lowStock: t.low_stock,
      outOfStock: t.out_of_stock, reviewsPending: t.reviews_pending, views: t.views, visitors: t.visitors,
      aov: Number(t.aov), emailFailures: t.email_failures,
      conversion: t.visitors ? Number(((t.orders_range / t.visitors) * 100).toFixed(2)) : 0,
      returningRate: 0,
    },
    statusCounts, series, topProducts, topCategories, recentOrders,
    lowStockProducts: lowStock,
  };

  return <AdminDashboard initial={initial} emailAlerts={{ failures: emailFailures[0].n }} />;
}
