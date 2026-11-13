import Link from 'next/link';
import { sql } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/auth';
import { StatusPill } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My account' };

export default async function AccountOverview() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  const [orders, stats, wishlist] = await Promise.all([
    sql`select id, order_number, status, grand_total, placed_at, currency from orders where customer_id = ${customer.id} order by placed_at desc limit 4`,
    sql`select count(*)::int orders, coalesce(sum(grand_total),0)::bigint spend from orders where customer_id = ${customer.id} and status not in ('cancelled')`,
    sql`select count(*)::int n from wishlists where customer_id = ${customer.id}`,
  ]);

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat"><small>Orders placed</small><strong>{stats[0].orders}</strong></div>
        <div className="stat"><small>Lifetime spend</small><strong>Rs {(Number(stats[0].spend) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></div>
        <div className="stat"><small>Saved items</small><strong>{wishlist[0].n}</strong></div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 20 }}>Recent orders</h3>
          <Link href="/account/orders" className="link-u">View all</Link>
        </div>
        {orders.length === 0 ? (
          <p className="muted" style={{ fontSize: 13.5 }}>No orders yet. <Link href="/shop" style={{ textDecoration: 'underline' }}>Start shopping</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Placed</th><th>Status</th><th>Total</th><th /></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.order_number}</strong></td>
                    <td className="muted">{new Date(o.placed_at).toLocaleDateString('en-GB')}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td>Rs {(Number(o.grand_total) / 100).toLocaleString('en-US')}</td>
                    <td><Link href={`/account/orders/${o.order_number}`} className="link-u" style={{ fontSize: 11 }}>Track</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
