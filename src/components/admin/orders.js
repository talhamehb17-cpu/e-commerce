'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusPill } from '../ui';
import { toast } from '../toast';
import { Search, Download, RefreshCw, ExternalLink, Ban } from '../icons';

const money = (m) => `Rs ${(Number(m) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];

export function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ q, status, limit: '60' });
    const res = await fetch(`/api/admin/orders?${qs}`, { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setOrders(d.orders); setCounts(d.counts); setTotal(d.total); }
    setLoading(false);
  }, [q, status]);

  useEffect(() => { load(); }, [load]);

  async function setOrderStatus(id, next) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not update', 'error'); return; }
    toast(`Status → ${next.replace(/_/g, ' ')}${data.emailed ? ' · customer emailed' : ''}`);
    setUpdating(null);
    load();
  }

  function exportCsv() {
    const rows = [['Order', 'Date', 'Customer', 'Email', 'Status', 'Payment', 'Total (PKR)', 'Tracking']];
    orders.forEach((o) => rows.push([
      o.order_number, new Date(o.placed_at).toISOString().slice(0, 10),
      o.shipping_address?.full_name || '', o.email, o.status, o.payment_method,
      (Number(o.grand_total) / 100).toFixed(2), o.tracking_number || '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('CSV exported');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <p>{total} orders total · updates email customers automatically.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={13} /> Export CSV</button>
          <button className="btn btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, opacity: 0.45 }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search order number, email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className="chip" data-on={status === 'all' ? 'true' : 'false'} onClick={() => setStatus('all')}>All ({total})</button>
        {STATUSES.map((s) => {
          const n = counts.find((c) => c.status === s)?.n || 0;
          return <button key={s} className="chip" data-on={status === s ? 'true' : 'false'} onClick={() => setStatus(s)}>{s.replace(/_/g, ' ')} ({n})</button>;
        })}
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 600 }}>{o.order_number}</Link>
                    <div className="sub" style={{ fontSize: 10.5 }}>{new Date(o.placed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5 }}>{o.shipping_address?.full_name || '—'}</div>
                    <div className="sub" style={{ fontSize: 10.5 }}>{o.email}</div>
                  </td>
                  <td>{o.item_count}</td>
                  <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{o.payment_method.replace(/_/g, ' ')}</td>
                  <td>
                    {updating === o.id ? (
                      <select className="input" style={{ padding: '4px 8px', fontSize: 11, width: 'auto' }} defaultValue={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)} autoFocus onBlur={() => setUpdating(null)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => setUpdating(o.id)}><StatusPill status={o.status} /></button>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(o.grand_total)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link href={`/admin/orders/${o.id}`} className="icon-btn" aria-label="Open order"><ExternalLink size={14} /></Link>
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && <tr><td colSpan={7} className="empty-state">No orders match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
