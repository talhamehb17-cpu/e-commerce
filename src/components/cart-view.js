'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from './providers';
import { toast } from './toast';
import { Empty } from './ui';
import { Minus, Plus, X, Truck, RotateCcw, ShieldCheck } from './icons';

export function CartView({ items: initialItems, totals: initialTotals }) {
  const { money } = useStore();
  const [items, setItems] = useState(initialItems);
  const [totals, setTotals] = useState(initialTotals);
  const [code, setCode] = useState(initialTotals?.coupon?.code || '');
  const [busy, setBusy] = useState(false);

  async function updateQty(id, qty) {
    const res = await fetch('/api/cart', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, qty }) });
    const data = await res.json();
    if (res.ok) { setItems(data.items); setTotals(data.totals); }
  }

  async function remove(id) {
    const res = await fetch(`/api/cart?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { setItems(data.items); setTotals(data.totals); toast('Removed'); }
  }

  async function applyCoupon(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/cart/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { toast(data.error || 'Invalid code', 'error'); if (data.totals) setTotals(data.totals); return; }
    setTotals(data.totals);
    toast(data.totals?.coupon ? 'Code applied' : 'Code removed');
  }

  if (!items.length) {
    return <Empty title="Your bag is empty" body="Nothing saved yet. Start with the new arrivals or best sellers." cta="Start shopping" href="/shop" />;
  }

  return (
    <div className="cart-layout">
      <div>
        {items.map((i) => (
          <div className="cart-line" key={i.id}>
            <Link href={`/products/${i.slug}`} style={{ position: 'relative', width: 96, aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', background: 'var(--surface2)' }}>
              <Image src={i.image} alt={i.name} fill sizes="96px" style={{ objectFit: 'cover' }} />
            </Link>
            <div>
              <Link href={`/products/${i.slug}`}><h4>{i.name}</h4></Link>
              <div className="muted" style={{ fontSize: 12 }}>{i.variant_name || i.material}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{money(i.unit_price)}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                <div className="qty">
                  <button onClick={() => updateQty(i.id, Math.max(1, i.qty - 1))} aria-label="Decrease"><Minus size={12} /></button>
                  <span>{i.qty}</span>
                  <button onClick={() => updateQty(i.id, Math.min(i.stock, i.qty + 1))} aria-label="Increase"><Plus size={12} /></button>
                </div>
                <button onClick={() => remove(i.id)} style={{ fontSize: 11.5, color: 'var(--muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
            <div style={{ fontSize: 14, textAlign: 'right' }}>{money(i.line_total)}</div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 22, fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Truck size={14} /> Free delivery over Rs 15,000</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><RotateCcw size={14} /> 30-day returns</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={14} /> Secure checkout</span>
        </div>
      </div>

      <aside className="summary">
        <h3>Order summary</h3>
        <div className="summary-row"><span>Subtotal ({totals.itemCount} items)</span><span>{money(totals.subtotal)}</span></div>
        {totals.discount > 0 && <div className="summary-row"><span>Discount {totals.coupon ? `(${totals.coupon.code})` : ''}</span><span style={{ color: 'var(--accent)' }}>−{money(totals.discount)}</span></div>}
        <div className="summary-row"><span>Delivery</span><span>{totals.shipping ? money(totals.shipping) : 'Free'}</span></div>
        <div className="summary-row total"><span>Total</span><span>{money(totals.total)}</span></div>

        <form onSubmit={applyCoupon} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input className="input" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} style={{ fontSize: 12.5 }} />
          <button className="btn btn-outline btn-sm" disabled={busy}>Apply</button>
        </form>
        {totals.couponError && <p style={{ fontSize: 11.5, color: '#a2372c', marginTop: 8 }}>{totals.couponError}</p>}

        <Link href="/checkout" className="btn btn-block" style={{ marginTop: 16 }}>Continue to checkout</Link>
        <Link href="/shop" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }}>Continue shopping</Link>
        <p className="muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
          Taxes calculated at checkout. Prices convert for display — card and COD settlement is in PKR.
        </p>
      </aside>
    </div>
  );
}
