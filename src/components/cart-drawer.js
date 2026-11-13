'use client';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useStore } from './providers';
import { toast } from './toast';
import { X, Minus, Plus, ShoppingBag, Truck } from './icons';

export function useCart(openDrawer) {
  const { setCartCount } = useStore();
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cart', { cache: 'no-store' });
      const data = await res.json();
      setItems(data.items || []);
      setTotals(data.totals || null);
      setCartCount(data.totals?.itemCount || 0);
    } catch { /* ignore */ }
  }, [setCartCount]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (payload) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Could not add to bag', 'error'); return false; }
      setItems(data.items || []);
      setTotals(data.totals || null);
      setCartCount(data.totals?.itemCount || 0);
      toast('Added to your bag');
      openDrawer?.();
      return true;
    } catch { toast('Network error', 'error'); return false; }
    finally { setLoading(false); }
  }, [openDrawer, setCartCount]);

  const updateQty = useCallback(async (id, qty) => {
    const res = await fetch('/api/cart', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, qty }) });
    const data = await res.json();
    if (res.ok) { setItems(data.items || []); setTotals(data.totals || null); setCartCount(data.totals?.itemCount || 0); }
  }, [setCartCount]);

  const remove = useCallback(async (id) => {
    const res = await fetch(`/api/cart?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { setItems(data.items || []); setTotals(data.totals || null); setCartCount(data.totals?.itemCount || 0); toast('Removed'); }
  }, [setCartCount]);

  const applyCoupon = useCallback(async (code) => {
    const res = await fetch('/api/cart/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Invalid code', 'error'); if (data.totals) setTotals(data.totals); return false; }
    setTotals(data.totals);
    toast(data.totals?.coupon ? 'Code applied' : 'Code removed');
    return true;
  }, []);

  return { items, totals, loading, add, updateQty, remove, applyCoupon, reload: load };
}

export function CartDrawer({ open, onClose, cartState }) {
  const { money } = useStore();
  const { items, totals, updateQty, remove, applyCoupon } = cartState;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="drawer" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer-panel" role="dialog" aria-label="Shopping bag">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Your bag</div>
            <h3 style={{ fontSize: 22, marginTop: 2 }}>{totals?.itemCount || 0} {totals?.itemCount === 1 ? 'item' : 'items'}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close bag"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          {items.length === 0 && (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <ShoppingBag size={30} strokeWidth={1.2} style={{ margin: '0 auto 14px', color: 'var(--muted)' }} />
              <p className="muted" style={{ fontSize: 13.5 }}>Your bag is empty.</p>
              <Link href="/shop" className="btn btn-outline btn-sm" style={{ marginTop: 18 }} onClick={onClose}>Start shopping</Link>
            </div>
          )}
          {items.map((i) => (
            <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: 14, padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
              <Link href={`/products/${i.slug}`} onClick={onClose} style={{ position: 'relative', width: 74, aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', background: 'var(--surface2)' }}>
                <Image src={i.image} alt={i.name} fill sizes="74px" style={{ objectFit: 'cover' }} />
              </Link>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <Link href={`/products/${i.slug}`} onClick={onClose} className="serif" style={{ fontSize: 17 }}>{i.name}</Link>
                  <button onClick={() => remove(i.id)} aria-label="Remove" style={{ opacity: 0.5 }}><X size={14} /></button>
                </div>
                {i.variant_name && <div className="muted" style={{ fontSize: 11.5 }}>{i.variant_name}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div className="qty" style={{ transform: 'scale(.86)', transformOrigin: 'left' }}>
                    <button onClick={() => updateQty(i.id, Math.max(1, i.qty - 1))} aria-label="Decrease"><Minus size={12} /></button>
                    <span>{i.qty}</span>
                    <button onClick={() => updateQty(i.id, i.qty + 1)} aria-label="Increase"><Plus size={12} /></button>
                  </div>
                  <span style={{ fontSize: 13 }}>{money(i.line_total)}</span>
                </div>
              </div>
            </div>
          ))}
          {items.length > 0 && (
            <div style={{ padding: '18px 0' }}>
              {totals?.freeShippingRemaining > 0
                ? <div className="notice" style={{ fontSize: 11.5 }}><Truck size={14} /> Add {money(totals.freeShippingRemaining)} for free delivery</div>
                : <div className="notice" style={{ fontSize: 11.5 }}><Truck size={14} /> Free delivery unlocked</div>}
              <form
                onSubmit={async (e) => { e.preventDefault(); setBusy(true); await applyCoupon(code); setBusy(false); }}
                style={{ display: 'flex', gap: 8, marginTop: 12 }}
              >
                <input className="input" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: '9px 12px', fontSize: 12.5 }} />
                <button className="btn btn-outline btn-sm" disabled={busy || !code}>{busy ? '…' : 'Apply'}</button>
              </form>
              {totals?.coupon && <div style={{ fontSize: 11.5, color: 'var(--accent)', marginTop: 8 }}>{totals.coupon.code} applied</div>}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="summary-row"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="summary-row"><span>Discount</span><span style={{ color: 'var(--accent)' }}>−{money(totals.discount)}</span></div>}
            <div className="summary-row"><span>Delivery</span><span>{totals.shipping ? money(totals.shipping) : 'Free'}</span></div>
            <div className="summary-row total"><span>Total</span><span>{money(totals.total)}</span></div>
            <Link href="/checkout" className="btn btn-block" style={{ marginTop: 14 }} onClick={onClose}>Checkout</Link>
            <Link href="/cart" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6 }} onClick={onClose}>View bag</Link>
          </div>
        )}
      </aside>
    </div>
  );
}
