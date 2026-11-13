'use client';
import { useEffect, useState } from 'react';
import { toast } from '../toast';
import { RefreshCw, Plus, Globe } from '../icons';

export function AdminCurrencies() {
  const [currencies, setCurrencies] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/currencies', { cache: 'no-store' });
    if (res.ok) setCurrencies((await res.json()).currencies);
  }
  useEffect(() => { load(); }, []);

  async function act(body, msg) {
    setBusy(true);
    const res = await fetch('/api/admin/currencies', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) { toast(msg); load(); } else toast(data.error || 'Request failed', 'error');
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Currencies</h1><p>All prices convert from PKR. Customers pick their currency; orders keep the rate that was charged.</p></div>
        <button className="btn btn-outline btn-sm" onClick={() => act({ action: 'refresh' }, 'Exchange rates refreshed')} disabled={busy}>
          <RefreshCw size={13} /> Refresh rates
        </button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Currency</th><th>Symbol</th><th>Rate → PKR</th><th>Example</th><th>Manual rate</th><th>Status</th><th style={{ textAlign: 'right' }}>Default</th></tr></thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.code}>
                  <td><strong>{c.code}</strong> <span className="sub">{c.name}</span></td>
                  <td>{c.symbol}</td>
                  <td>
                    <input className="input" type="number" step="0.000001" defaultValue={c.rate_to_base} style={{ width: 100, padding: '4px 6px', fontSize: 11.5 }}
                      onBlur={(e) => Number(e.target.value) !== Number(c.rate_to_base) && act({ action: 'update', code: c.code, rate: e.target.value, manualOverride: true }, `${c.code} rate saved`)} />
                  </td>
                  <td className="sub">Rs 10,000 → {c.symbol}{((10000 / Number(c.rate_to_base))).toFixed(c.decimals)}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={Boolean(c.manual_override)} onChange={(e) => act({ action: 'update', code: c.code, manualOverride: e.target.checked }, 'Preference saved')} />
                    </label>
                  </td>
                  <td>
                    <button onClick={() => act({ action: 'update', code: c.code, isActive: !c.is_active }, 'Updated')} className={`pill ${c.is_active ? 'delivered' : ''}`} style={{ cursor: 'pointer' }}>
                      {c.is_active ? 'Enabled' : 'Off'}
                    </button>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {c.is_default ? <span className="pill delivered">Base</span> : <button className="chip" onClick={() => act({ action: 'update', code: c.code, isDefault: true }, 'Default currency changed')}>Set default</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3 style={{ fontSize: 16 }}><Globe size={14} /> Add a currency</h3></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 160, textTransform: 'uppercase' }} maxLength={3} placeholder="e.g. JPY" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
          <button className="btn btn-sm" disabled={newCode.length !== 3} onClick={() => { act({ action: 'add', code: newCode }, `${newCode} added`); setNewCode(''); }}><Plus size={12} /> Add currency</button>
        </div>
        <p className="sub" style={{ fontSize: 11.5, marginTop: 10 }}>Codes use ISO 4217 (three letters). Rates are pulled from an exchange-rate API hourly unless a manual rate is locked.</p>
      </div>
    </div>
  );
}
