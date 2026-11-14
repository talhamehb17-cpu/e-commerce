import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/auth';
import { getCurrentAdmin } from '@/lib/auth';
import { fulfillOrder, timelineFor } from '@/lib/orders';
import { StatusPill } from '@/components/ui';
import { Truck, MapPin, CreditCard } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function OrderDetail({ params }) {
  const { number } = await params;
  const [customer, admin] = await Promise.all([getCurrentCustomer(), getCurrentAdmin()]);
  const order = await fulfillOrder(number);
  if (!order) notFound();
  if (!admin && (!customer || order.customer_id !== customer.id)) notFound();

  const events = await sql`select status, note, created_at, email_sent from order_events where order_id = ${order.id} order by created_at`;
  const timeline = timelineFor(order, events);
  const addr = order.shipping_address || {};
  const money = (n) => `Rs ${(Number(n) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Order {order.order_number}</div>
          <h2 style={{ fontSize: 26, marginTop: 4 }}>{new Date(order.placed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><MapPin size={15} /> <strong style={{ fontSize: 12.5 }}>Delivering to</strong></div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {addr.full_name}<br />{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />{addr.city}{addr.state ? `, ${addr.state}` : ''}<br />{addr.country}
          </p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><CreditCard size={15} /> <strong style={{ fontSize: 12.5 }}>Payment</strong></div>
          <p className="muted" style={{ fontSize: 13 }}>{order.payment_method.replace(/_/g, ' ')} · {order.payment_status}</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>{money(order.grand_total)}</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><Truck size={15} /> <strong style={{ fontSize: 12.5 }}>Tracking</strong></div>
          {order.tracking_number ? (
            <>
              <p style={{ fontSize: 13 }}>{order.tracking_number}</p>
              <p className="muted" style={{ fontSize: 12 }}>{order.carrier || 'Courier'}</p>
            </>
          ) : <p className="muted" style={{ fontSize: 13 }}>Tracking appears once dispatched.</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 14 }} className="order-grid">
        <div className="card">
          <h3 style={{ fontSize: 19, marginBottom: 16 }}>Delivery timeline</h3>
          <div className="timeline">
            {timeline.map((t) => (
              <div className="tl-step" key={t.status} data-done={t.done ? 'true' : 'false'}>
                <strong style={{ opacity: t.done ? 1 : 0.45 }}>{t.status.replace(/_/g, ' ')}</strong>
                <small>{t.at ? new Date(t.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Pending'}</small>
                {t.note && <small style={{ display: 'block', marginTop: 2 }}>{t.note}</small>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 19, marginBottom: 14 }}>Items</h3>
          {(order.items || []).map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              {it.image_url ? (
                <div style={{ position: 'relative', width: 48, height: 60, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
                  <Image src={it.image_url} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />
                </div>
              ) : <div style={{ width: 48, height: 60, borderRadius: 6, background: 'var(--surface2)' }} />}
              <div>
                <div style={{ fontSize: 13 }}>{it.name}</div>
                <div className="muted" style={{ fontSize: 11 }}>{it.variant_name ? `${it.variant_name} · ` : ''}Qty {it.qty}</div>
              </div>
              <div style={{ fontSize: 12.5 }}>{money(it.line_total)}</div>
            </div>
          ))}
          <div className="hr" style={{ margin: '12px 0' }} />
          <div className="summary-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
          {order.discount_total > 0 && <div className="summary-row"><span>Discount</span><span>−{money(order.discount_total)}</span></div>}
          <div className="summary-row"><span>Delivery</span><span>{order.shipping_total ? money(order.shipping_total) : 'Free'}</span></div>
          <div className="summary-row total"><span>Total</span><span>{money(order.grand_total)}</span></div>
          <Link href="/account/orders" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 12 }}>Back to orders</Link>
        </div>
      </div>

      <style>{`@media(max-width:900px){.order-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
