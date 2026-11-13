'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { StatusPill } from '../ui';
import { toast } from '../toast';
import { Check, Truck, Mail, Printer, ArrowRight } from '../icons';

const money = (m) => `Rs ${(Number(m) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];

export function AdminOrderDetail({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: '', note: '', trackingNumber: '', carrier: '', sendEmail: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/orders/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setForm((f) => ({ ...f, status: d.order.status, trackingNumber: d.order.tracking_number || '', carrier: d.order.carrier || '' }));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function update() {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { toast(d.error || 'Could not update', 'error'); return; }
    toast(`Status updated${d.emailed ? ' · customer emailed' : ' · no email sent'}`);
    setForm((f) => ({ ...f, note: '' }));
    load();
  }

  if (loading) return <div className="panel">Loading order…</div>;
  if (!data?.order) return <div className="panel">Order not found.</div>;
  const { order, events, customer } = data;
  const addr = order.shipping_address || {};

  return (
    <div>
      <div className="page-head">
        <div>
          <Link href="/admin/orders" className="sub" style={{ fontSize: 11.5 }}>← Back to orders</Link>
          <h1 style={{ marginTop: 4 }}>{order.order_number}</h1>
          <p>{new Date(order.placed_at).toLocaleString('en-GB')} · {order.items?.length} items · <StatusPill status={order.status} /></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={13} /> Print</button>
          <a className="btn btn-outline btn-sm" href={`/account/orders/${order.order_number}`} target="_blank" rel="noreferrer">Customer view</a>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.35fr .9fr' }}>
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head"><h3>Items</h3><span className="sub">{money(order.grand_total)}</span></div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>Product</th><th>Qty</th><th style={{ textAlign: 'right' }}>Unit</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {(order.items || []).map((it, i) => (
                    <tr key={i}>
                      <td>
                        <div className="cell-prod">
                          {it.image_url ? <Image src={it.image_url} alt="" width={34} height={40} style={{ borderRadius: 5, objectFit: 'cover' }} /> : <div style={{ width: 34, height: 40, background: 'var(--surface2)', borderRadius: 5 }} />}
                          <div><strong style={{ fontSize: 12 }}>{it.name}</strong>{it.variant_name && <div className="sub" style={{ fontSize: 10 }}>{it.variant_name}</div>}</div>
                        </div>
                      </td>
                      <td>{it.qty}</td>
                      <td style={{ textAlign: 'right' }}>{money(it.unit_price)}</td>
                      <td style={{ textAlign: 'right' }}>{money(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, maxWidth: 300, marginLeft: 'auto' }}>
              <div className="summary-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              {order.discount_total > 0 && <div className="summary-row"><span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span><span>−{money(order.discount_total)}</span></div>}
              <div className="summary-row"><span>Shipping</span><span>{order.shipping_total ? money(order.shipping_total) : 'Free'}</span></div>
              {order.tax_total > 0 && <div className="summary-row"><span>Tax</span><span>{money(order.tax_total)}</span></div>}
              <div className="summary-row total"><span>Total</span><span>{money(order.grand_total)}</span></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Status history</h3></div>
            <div className="timeline">
              {events.map((e, i) => (
                <div className="tl-step" data-done="true" key={i}>
                  <strong>{e.status.replace(/_/g, ' ')}</strong>
                  <small>{new Date(e.created_at).toLocaleString('en-GB')} · {e.actor}</small>
                  {e.note && <small style={{ display: 'block' }}>{e.note}</small>}
                  {e.email_sent ? <small style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#2b6a3e', marginTop: 2 }}><Mail size={10} /> emailed</small> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head"><h3 style={{ fontSize: 17 }}>Update status</h3></div>
            <div className="field">
              <label>Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="field"><label>Tracking number</label><input className="input" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} placeholder="TCS-123456" /></div>
              <div className="field"><label>Carrier</label><input className="input" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="TCS / Leopards" /></div>
            </div>
            <div className="field"><label>Note to customer (optional)</label><textarea className="input" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Included in the status email" /></div>
            <label className="checkbox" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
              Email the customer about this change
            </label>
            <button className="btn btn-block" onClick={update} disabled={saving}>{saving ? 'Saving…' : <><Check size={14} /> Save status</>}</button>
            <p className="sub" style={{ fontSize: 10.5, marginTop: 8 }}>Emails only send when the status actually changes, so customers never get duplicates.</p>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head"><h3 style={{ fontSize: 17 }}>Customer</h3></div>
            <p style={{ fontSize: 12.5 }}>{addr.full_name}<br /><span className="sub">{order.email}</span><br /><span className="sub">{order.phone}</span></p>
            {customer && <Link href="/admin/customers" className="link-u" style={{ fontSize: 10.5, display: 'inline-block', marginTop: 8 }}>View customer</Link>}
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head"><h3 style={{ fontSize: 17 }}>Ship to</h3></div>
            <p style={{ fontSize: 12.5, lineHeight: 1.7 }}>
              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
              {addr.city}{addr.state ? `, ${addr.state}` : ''} {addr.postal_code}<br />
              {addr.country}
            </p>
          </div>

          <div className="panel">
            <div className="panel-head"><h3 style={{ fontSize: 17 }}>Payment</h3></div>
            <div className="summary-row"><span>Method</span><span style={{ textTransform: 'capitalize' }}>{order.payment_method.replace(/_/g, ' ')}</span></div>
            <div className="summary-row"><span>Status</span><span>{order.payment_status}</span></div>
            <div className="summary-row"><span>Currency</span><span>{order.currency} @ {Number(order.fx_rate).toFixed(4)}</span></div>
            <div className="summary-row"><span>Charged</span><span>{order.currency} {(Number(order.display_total) / 100).toFixed(2)}</span></div>
            {order.notes && <p className="sub" style={{ fontSize: 11.5, marginTop: 8 }}>Customer note: {order.notes}</p>}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:1000px){.admin-grid[style*="1.35fr"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
