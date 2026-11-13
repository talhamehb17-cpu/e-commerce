'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { Plus, Minus, RefreshCw, AlertCircle } from '../icons';

export function AdminInventory() {
  const [rows, setRows] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/inventory', { cache: 'no-store' });
    if (res.ok) { const d = await res.json(); setRows(d.inventory); setMoves(d.moves); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function adjust(productId, delta) {
    const res = await fetch('/api/admin/inventory', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, delta, reason: 'manual_adjust' }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not adjust', 'error'); return; }
    setRows((r) => r.map((x) => (x.id === productId ? { ...x, stock: data.stock } : x)));
    toast(`Stock set to ${data.stock}`);
    load();
  }

  const low = rows.filter((r) => r.stock > 0 && r.stock <= r.low_stock_threshold);
  const out = rows.filter((r) => r.stock === 0);

  return (
    <div>
      <div className="page-head">
        <div><h1>Inventory</h1><p>Every adjustment is logged with an actor and timestamp.</p></div>
        <button className="btn btn-outline btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="admin-grid kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi"><small>Tracked products</small><strong>{rows.length}</strong></div>
        <div className="kpi" style={{ borderColor: 'color-mix(in srgb,var(--accent) 40%,var(--line))' }}><small>Low stock</small><strong>{low.length}</strong></div>
        <div className="kpi" style={{ borderColor: 'color-mix(in srgb,#b4453a 40%,var(--line))' }}><small>Out of stock</small><strong>{out.length}</strong></div>
        <div className="kpi"><small>Total units</small><strong>{rows.reduce((s, r) => s + r.stock, 0).toLocaleString()}</strong></div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: '1.4fr .8fr' }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-head" style={{ padding: '16px 18px 8px' }}><h3>Stock levels</h3></div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Threshold</th><th style={{ textAlign: 'right' }}>Adjust</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={r.stock === 0 ? { background: 'color-mix(in srgb,#b4453a 5%,transparent)' } : r.stock <= r.low_stock_threshold ? { background: 'color-mix(in srgb,var(--accent) 6%,transparent)' } : undefined}>
                    <td><strong style={{ fontSize: 12 }}>{r.name}</strong><div className="sub" style={{ fontSize: 10 }}>{r.category_name || '—'}</div></td>
                    <td className="sub">{r.sku || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: r.stock === 0 ? '#a2372c' : r.stock <= r.low_stock_threshold ? 'var(--accent)' : 'inherit' }}>{r.stock}</span>
                      {r.stock === 0 && <AlertCircle size={11} style={{ display: 'inline', marginLeft: 4, color: '#a2372c' }} />}
                    </td>
                    <td className="sub">{r.low_stock_threshold}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <input
                        className="input" type="number" min="0" style={{ width: 64, padding: '4px 6px', fontSize: 11.5, display: 'inline-block' }}
                        value={editing[r.id] ?? ''} placeholder="set"
                        onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && editing[r.id] !== '') { adjust(r.id, Number(editing[r.id]) - r.stock); setEditing((s) => ({ ...s, [r.id]: '' })); } }}
                      />
                      <button className="icon-btn" onClick={() => { adjust(r.id, 1); }} aria-label="Add one"><Plus size={13} /></button>
                      <button className="icon-btn" onClick={() => adjust(r.id, -1)} aria-label="Remove one"><Minus size={13} /></button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && <tr><td colSpan={5} className="empty-state">No products tracked yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Recent movements</h3></div>
          {moves.length === 0 && <p className="sub">No movements logged yet.</p>}
          {moves.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 11.5 }}>
              <strong style={{ color: m.delta > 0 ? '#2b6a3e' : '#a2372c', width: 36 }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</strong>
              <span style={{ flex: 1 }}>{m.name || 'Product'}</span>
              <span className="sub" style={{ fontSize: 10 }}>{m.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
