'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '../toast';
import { Search, Ban, UserCheck, Download } from '../icons';

const money = (m) => `Rs ${(Number(m) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export function AdminCustomers({ initial = [] }) {
  const [customers, setCustomers] = useState(initial);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
    if (res.ok) setCustomers((await res.json()).customers);
    setLoading(false);
  }, [q]);
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function toggleBlock(c) {
    const next = !c.is_blocked;
    if (next && !confirm(`Block ${c.email}? They will be signed out and unable to log in.`)) return;
    const res = await fetch(`/api/admin/customers/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isBlocked: next }),
    });
    if (res.ok) {
      setCustomers((list) => list.map((x) => (x.id === c.id ? { ...x, is_blocked: next } : x)));
      toast(next ? 'Customer blocked' : 'Customer unblocked');
    }
  }

  function exportCsv() {
    const rows = [['Name', 'Email', 'Phone', 'Orders', 'Lifetime value (PKR)', 'Verified', 'Joined']];
    customers.forEach((c) => rows.push([c.name, c.email, c.phone || '', c.order_count, (Number(c.lifetime_value) / 100).toFixed(2), c.email_verified, new Date(c.created_at).toISOString().slice(0, 10)]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'customers.csv';
    a.click();
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Customers</h1><p>{customers.length} accounts · lifetime value computed from real orders.</p></div>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}><Download size={13} /> Export CSV</button>
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, opacity: 0.45 }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn btn-sm" onClick={load}>{loading ? 'Loading…' : 'Search'}</button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Customer</th><th>Orders</th><th>Lifetime value</th><th>Verified</th><th>Joined</th><th>Last login</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="cell-prod">
                      <span className="avatar" style={{ width: 30, height: 30 }}>{c.name[0]}</span>
                      <div><strong style={{ fontSize: 12.5 }}>{c.name}</strong><div className="sub" style={{ fontSize: 10.5 }}>{c.email}</div></div>
                    </div>
                  </td>
                  <td>{c.order_count}</td>
                  <td>{money(c.lifetime_value)}</td>
                  <td>{c.email_verified ? <span className="pill delivered">Verified</span> : <span className="pill pending">Unverified</span>}</td>
                  <td className="sub">{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                  <td className="sub">{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="icon-btn" onClick={() => toggleBlock(c)} aria-label={c.is_blocked ? 'Unblock' : 'Block'} title={c.is_blocked ? 'Unblock' : 'Block'}>
                      {c.is_blocked ? <UserCheck size={14} /> : <Ban size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && <tr><td colSpan={7} className="empty-state">No customers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
