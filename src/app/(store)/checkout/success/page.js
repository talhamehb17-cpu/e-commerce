import Link from 'next/link';
import { sql } from '@/lib/db';
import { CheckCircle2, Package } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order confirmed' };

export default async function SuccessPage({ searchParams }) {
  const { order } = await searchParams;
  const rows = order ? await sql`select order_number, status, grand_total, currency, display_total, email, placed_at from orders where order_number = ${order}` : [];
  const o = rows[0];

  return (
    <div className="wrap" style={{ padding: 'clamp(40px,7vw,100px) 0', maxWidth: 620, textAlign: 'center' }}>
      <CheckCircle2 size={46} strokeWidth={1.2} style={{ color: 'var(--accent)', margin: '0 auto 20px' }} />
      <h1 style={{ fontSize: 'clamp(30px,4vw,46px)' }}>Thank you</h1>
      {o ? (
        <>
          <p className="muted" style={{ marginTop: 12, fontSize: 14.5 }}>
            Your order <strong style={{ color: 'var(--ink)' }}>{o.order_number}</strong> is confirmed. A receipt is on its way to {o.email}.
          </p>
          <div className="card" style={{ marginTop: 26, textAlign: 'left' }}>
            <div className="summary-row"><span>Order</span><span>{o.order_number}</span></div>
            <div className="summary-row"><span>Placed</span><span>{new Date(o.placed_at).toLocaleString('en-GB')}</span></div>
            <div className="summary-row"><span>Payment</span><span style={{ textTransform: 'capitalize' }}>{o.status}</span></div>
            <div className="summary-row total"><span>Total</span><span>Rs {(Number(o.grand_total) / 100).toLocaleString('en-US')}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
            <Link className="btn" href={`/account/orders/${o.order_number}`}><Package size={15} /> Track order</Link>
            <Link className="btn btn-outline" href="/shop">Continue shopping</Link>
          </div>
        </>
      ) : (
        <p className="muted" style={{ marginTop: 12 }}>Your order was placed. Check your email for the confirmation.</p>
      )}
    </div>
  );
}
