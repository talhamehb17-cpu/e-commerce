'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Plus, Trash2, X, Ticket } from '../icons';

export function AdminDiscounts() {
  const [coupons, setCoupons] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/coupons', { cache: 'no-store' });
    if (res.ok) setCoupons((await res.json()).coupons);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const payload = {
      code: editing.code, type: editing.type,
      value: Number(editing.value) || 0,
      minSubtotal: Number(editing.min_subtotal || 0),
      maxDiscount: editing.max_discount ? Number(editing.max_discount) : null,
      usageLimit: editing.usage_limit ? Number(editing.usage_limit) : null,
      startsAt: editing.starts_at ? `${String(editing.starts_at).slice(0, 10)}T00:00:00.000Z` : null,
      endsAt: editing.ends_at ? `${String(editing.ends_at).slice(0, 10)}T23:59:59.999Z` : null,
      isActive: editing.is_active !== false,
    };
    const res = await fetch(editing.id ? `/api/admin/coupons/${editing.id}` : '/api/admin/coupons', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing.id ? { isActive: payload.isActive, usageLimit: payload.usageLimit, startsAt: payload.startsAt, endsAt: payload.endsAt, value: editing.type === 'percent' ? payload.value : undefined } : payload),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not save', 'error'); return; }
    toast('Discount saved');
    setEditing(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this discount code?')) return;
    await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    toast('Deleted');
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Discounts</h1><p>Percentage, fixed-amount and free-shipping codes with usage limits.</p></div>
        <button className="btn btn-sm" onClick={() => setEditing({ code: '', type: 'percent', value: 10, min_subtotal: '', is_active: true })}><Plus size={13} /> New code</button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min spend</th><th>Used</th><th>Ends</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td><strong style={{ letterSpacing: '.08em' }}>{c.code}</strong></td>
                  <td style={{ textTransform: 'capitalize' }}>{c.type}</td>
                  <td>{c.type === 'percent' ? `${c.value}%` : c.type === 'fixed' ? `Rs ${(c.value / 100).toLocaleString()}` : 'Free ship'}</td>
                  <td>{c.min_subtotal ? `Rs ${(c.min_subtotal / 100).toLocaleString()}` : '—'}</td>
                  <td>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                  <td className="sub">{c.ends_at ? new Date(c.ends_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td><span className={`pill ${c.is_active ? 'delivered' : ''}`}>{c.is_active ? 'Active' : 'Off'}</span></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="icon-btn" onClick={() => setEditing(c)} aria-label="Edit"><Ticket size={14} /></button>
                    <button className="icon-btn" onClick={() => remove(c.id)} aria-label="Delete"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!loading && coupons.length === 0 && <tr><td colSpan={8} className="empty-state">No discount codes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modal" data-open="true">
          <div className="modal-scrim" onClick={() => setEditing(null)} />
          <div className="modal-panel" style={{ width: 'min(480px,100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 19 }}>{editing.id ? 'Edit code' : 'New discount code'}</h3>
              <button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={17} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="field"><label>Code</label><input className="input" value={editing.code} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" style={{ letterSpacing: '.1em' }} /></div>
              <div className="form-row">
                <div className="field">
                  <label>Type</label>
                  <select className="input" value={editing.type} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="freeship">Free shipping</option>
                  </select>
                </div>
                <div className="field">
                  <label>{editing.type === 'percent' ? 'Percent off' : editing.type === 'fixed' ? 'Amount (PKR)' : '—'}</label>
                  <input className="input" type="number" disabled={editing.type === 'freeship'} value={editing.type === 'fixed' ? editing.value / 100 : editing.value} onChange={(e) => setEditing({ ...editing, value: editing.type === 'fixed' ? Number(e.target.value) * 100 : Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-row">
                <div className="field"><label>Minimum spend (PKR)</label><input className="input" type="number" value={editing.min_subtotal ? editing.min_subtotal / 100 : ''} onChange={(e) => setEditing({ ...editing, min_subtotal: Number(e.target.value) * 100 })} /></div>
                <div className="field"><label>Usage limit</label><input className="input" type="number" value={editing.usage_limit || ''} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} placeholder="unlimited" /></div>
              </div>
              <div className="form-row"><div className="field"><label>Starts on (optional)</label><input className="input" type="date" value={editing.starts_at ? String(editing.starts_at).slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} /></div><div className="field"><label>Ends on (optional)</label><input className="input" type="date" value={editing.ends_at ? String(editing.ends_at).slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} /></div></div>
              <label className="switch" style={{ marginBottom: 14 }}><input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Active</label>
              <button className="btn btn-block" onClick={save}>Save discount</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
