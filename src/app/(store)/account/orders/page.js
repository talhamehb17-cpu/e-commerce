import Link from 'next/link';
import { sql } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/auth';
import { StatusPill, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order history' };

export default async function OrdersPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  const orders = await sql`
    select o.id, o.order_number, o.status, o.grand_total, o.placed_at, o.display_total, o.currency,
      (select count(*)::int from order_items oi where oi.order_id = o.id) as items,
      (select image_url from order_items oi where oi.order_id = o.id limit 1) as image
    from orders o where o.customer_id = ${customer.id} order by o.placed_at desc`;

  if (!orders.length) return <Empty title="No orders yet" body="When you place an order it will appear here with live tracking." cta="Start shopping" href="/shop" />;

  return (
    <div className="card">
      <h3 style={{ fontSize: 20, marginBottom: 14 }}>All orders</h3>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.order_number}</strong></td>
                <td className="muted">{new Date(o.placed_at).toLocaleDateString('en-GB')}</td>
                <td>{o.items}</td>
                <td><StatusPill status={o.status} /></td>
                <td>Rs {(Number(o.grand_total) / 100).toLocaleString('en-US')}</td>
                <td><Link href={`/account/orders/${o.order_number}`} className="link-u" style={{ fontSize: 11 }}>Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
