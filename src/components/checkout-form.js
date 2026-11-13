'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from './providers';
import { toast } from './toast';
import { Lock, Check, CreditCard, Wallet, Truck } from './icons';

export function CheckoutForm({ items, totals, customer, addresses, payments, currencies, defaultCurrency }) {
  const { money, setCartCount } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const def = addresses.find((a) => a.is_default_shipping) || addresses[0];
  const [form, setForm] = useState({
    email: customer?.email || '',
    phone: customer?.phone || def?.phone || '',
    fullName: def?.full_name || customer?.name || '',
    line1: def?.line1 || '',
    line2: def?.line2 || '',
    city: def?.city || '',
    state: def?.state || '',
    postalCode: def?.postal_code || '',
    country: def?.country || 'Pakistan',
    paymentMethod: payments.cod ? 'cod' : 'bank_transfer',
    shippingMethod: 'standard',
    notes: '',
    saveAddress: true,
  });
  const [coupon, setCoupon] = useState(totals?.coupon?.code || '');
  const [localTotals, setLocalTotals] = useState(totals);
  const currency = defaultCurrency;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function applyCoupon(e) {
    e.preventDefault();
    const res = await fetch('/api/cart/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: coupon }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Invalid code', 'error'); if (data.totals) setLocalTotals(data.totals); return; }
    setLocalTotals({ ...data.totals, shipping: data.totals.shipping });
    toast('Code applied');
    router.refresh();
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, currency, couponCode: localTotals?.coupon?.code || coupon || '' }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not place order'); setBusy(false); return; }
    setCartCount(0);
    router.push(`/checkout/success?order=${data.orderNumber}`);
  }

  return (
    <>
      <form onSubmit={submit}>
        <div className="steps">
          <span>Bag</span><span className="active">Delivery</span><span>Done</span>
        </div>
        {error && <div className="alert error">{error}</div>}

        {addresses.length > 0 && (
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Saved addresses</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {addresses.map((a) => (
                <button
                  type="button" key={a.id} className="chip"
                  onClick={() => setForm((f) => ({ ...f, fullName: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2 || '', city: a.city, state: a.state || '', postalCode: a.postal_code || '', country: a.country }))}
                >
                  {a.label || a.city} · {a.full_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, marginBottom: 14 }}>Contact</h3>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cemail">Email</label>
              <input id="cemail" type="email" required className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="cphone">Phone</label>
              <input id="cphone" required className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="03xx xxxxxxx" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, marginBottom: 14 }}>Delivery address</h3>
          <div className="field">
            <label htmlFor="cname">Full name</label>
            <input id="cname" required className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="c1">Address line 1</label>
            <input id="c1" required className="input" value={form.line1} onChange={(e) => set('line1', e.target.value)} placeholder="House, street" />
          </div>
          <div className="field">
            <label htmlFor="c2">Address line 2 (optional)</label>
            <input id="c2" className="input" value={form.line2} onChange={(e) => set('line2', e.target.value)} placeholder="Apartment, landmark" />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ccity">City</label>
              <input id="ccity" required className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cstate">State / province</label>
              <input id="cstate" className="input" value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="cpost">Postal code</label>
              <input id="cpost" className="input" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ccountry">Country</label>
              <input id="ccountry" required className="input" value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
          </div>
          {customer && (
            <label className="checkbox"><input type="checkbox" checked={form.saveAddress} onChange={(e) => set('saveAddress', e.target.checked)} /> Save this address to my account</label>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, marginBottom: 14 }}>Delivery method</h3>
          <label className="pay-opt">
            <input type="radio" name="ship" checked={form.shippingMethod === 'standard'} onChange={() => set('shippingMethod', 'standard')} />
            <div style={{ flex: 1 }}>
              <strong>Standard · 3–5 business days</strong>
              <small>{localTotals.subtotal - localTotals.discount >= 1500000 ? 'Free' : 'Rs 350'}</small>
            </div>
            <Truck size={16} style={{ opacity: 0.5 }} />
          </label>
          <label className="pay-opt">
            <input type="radio" name="ship" checked={form.shippingMethod === 'express'} onChange={() => set('shippingMethod', 'express')} />
            <div style={{ flex: 1 }}>
              <strong>Express · 1–2 business days</strong>
              <small>Rs 900</small>
            </div>
          </label>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, marginBottom: 14 }}>Payment</h3>
          {payments.cod && (
            <label className="pay-opt">
              <input type="radio" name="pay" checked={form.paymentMethod === 'cod'} onChange={() => set('paymentMethod', 'cod')} />
              <div style={{ flex: 1 }}><strong>Cash on delivery</strong><small>Pay the courier when your order arrives</small></div>
              <Wallet size={16} style={{ opacity: 0.5 }} />
            </label>
          )}
          {payments.bank_transfer && (
            <label className="pay-opt">
              <input type="radio" name="pay" checked={form.paymentMethod === 'bank_transfer'} onChange={() => set('paymentMethod', 'bank_transfer')} />
              <div style={{ flex: 1 }}><strong>Bank transfer</strong><small>Instructions emailed after you order</small></div>
              <CreditCard size={16} style={{ opacity: 0.5 }} />
            </label>
          )}
          {payments.easypaisa && (
            <label className="pay-opt">
              <input type="radio" name="pay" checked={form.paymentMethod === 'easypaisa'} onChange={() => set('paymentMethod', 'easypaisa')} />
              <div style={{ flex: 1 }}><strong>Easypaisa</strong><small>Send to {payments.easypaisa}</small></div>
            </label>
          )}
          {payments.jazzcash && (
            <label className="pay-opt">
              <input type="radio" name="pay" checked={form.paymentMethod === 'jazzcash'} onChange={() => set('paymentMethod', 'jazzcash')} />
              <div style={{ flex: 1 }}><strong>JazzCash</strong><small>Send to {payments.jazzcash}</small></div>
            </label>
          )}
          {form.paymentMethod === 'bank_transfer' && (
            <div className="notice" style={{ whiteSpace: 'pre-line', marginTop: 8, fontSize: 12 }}>{payments.bank_details}</div>
          )}
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="cnotes">Order notes (optional)</label>
            <textarea id="cnotes" className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Delivery instructions, gift note…" style={{ minHeight: 80 }} />
          </div>
        </div>

        <button className="btn btn-block" disabled={busy} style={{ padding: 16 }}>
          {busy ? 'Placing order…' : `Place order · ${money(localTotals.total)}`}
        </button>
        <p className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Lock size={11} /> Encrypted checkout. Your details are never shared.
        </p>
      </form>

      <aside className="summary">
        <h3>Your order</h3>
        {items.map((i) => (
          <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative', width: 52, height: 64, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)' }}>
              <Image src={i.image} alt="" fill sizes="52px" style={{ objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, lineHeight: 1.3 }}>{i.name}</div>
              <div className="muted" style={{ fontSize: 11 }}>{i.variant_name ? `${i.variant_name} · ` : ''}Qty {i.qty}</div>
            </div>
            <div style={{ fontSize: 12.5 }}>{money(i.line_total)}</div>
          </div>
        ))}
        <div className="hr" style={{ margin: '14px 0' }} />
        <form onSubmit={applyCoupon} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="input" placeholder="Discount code" value={coupon} onChange={(e) => setCoupon(e.target.value)} style={{ fontSize: 12.5 }} />
          <button className="btn btn-outline btn-sm">Apply</button>
        </form>
        <div className="summary-row"><span>Subtotal</span><span>{money(localTotals.subtotal)}</span></div>
        {localTotals.discount > 0 && <div className="summary-row"><span>Discount</span><span style={{ color: 'var(--accent)' }}>−{money(localTotals.discount)}</span></div>}
        <div className="summary-row"><span>Delivery</span><span>{localTotals.shipping ? money(localTotals.shipping) : 'Free'}</span></div>
        <div className="summary-row total"><span>Total</span><span>{money(localTotals.total)}</span></div>
        <p className="muted" style={{ fontSize: 10.5, marginTop: 10, lineHeight: 1.5 }}>
          Displayed in {currency}. Settlement currency: PKR ({new Intl.NumberFormat('en-US').format(Math.round(localTotals.total / 100))}).
        </p>
        <Link href="/cart" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 6 }}>Edit bag</Link>
      </aside>
    </>
  );
}
