'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './toast';
import { Trash2, Plus, MapPin } from './icons';

const EMPTY = { label: '', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'Pakistan', isDefault: false };

export function AddressManager({ initial }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(initial.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/account/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not save address'); return; }
    setAddresses((a) => [data.address, ...a]);
    setForm(EMPTY); setOpen(false);
    toast('Address saved');
    router.refresh();
  }

  async function remove(id) {
    await fetch(`/api/account/addresses?id=${id}`, { method: 'DELETE' });
    setAddresses((a) => a.filter((x) => x.id !== id));
    toast('Address removed');
  }

  async function makeDefault(id) {
    await fetch('/api/account/addresses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setAddresses((a) => a.map((x) => ({ ...x, is_default_shipping: x.id === id })));
    toast('Default address updated');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="serif" style={{ fontSize: 24 }}>Saved addresses</h3>
        <button className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}><Plus size={13} /> Add address</button>
      </div>

      {addresses.length === 0 && !open && <p className="muted" style={{ fontSize: 13.5 }}>No addresses saved yet.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
        {addresses.map((a) => (
          <div className="card" key={a.id} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <MapPin size={14} />
              <strong style={{ fontSize: 12.5 }}>{a.label || 'Address'}</strong>
              {a.is_default_shipping && <span className="pill delivered" style={{ fontSize: 9 }}>Default</span>}
            </div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
              {a.full_name}<br />{a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}{a.state ? `, ${a.state}` : ''} {a.postal_code}<br />{a.country}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              {!a.is_default_shipping && <button onClick={() => makeDefault(a.id)} className="link-u" style={{ fontSize: 10.5 }}>Make default</button>}
              <button onClick={() => remove(a.id)} style={{ fontSize: 11, color: '#a2372c', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Trash2 size={11} /> Remove</button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <form onSubmit={save} className="card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 19, marginBottom: 14 }}>New address</h3>
          {error && <div className="alert error">{error}</div>}
          <div className="form-row">
            <div className="field"><label htmlFor="al">Label</label><input id="al" className="input" placeholder="Home, Office" value={form.label} onChange={(e) => set('label', e.target.value)} /></div>
            <div className="field"><label htmlFor="an">Full name</label><input id="an" required className="input" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="ap">Phone</label><input id="ap" required className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="field"><label htmlFor="al1">Address line 1</label><input id="al1" required className="input" value={form.line1} onChange={(e) => set('line1', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="al2">Address line 2</label><input id="al2" className="input" value={form.line2} onChange={(e) => set('line2', e.target.value)} /></div>
            <div className="field"><label htmlFor="ac">City</label><input id="ac" required className="input" value={form.city} onChange={(e) => set('city', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="as">State</label><input id="as" className="input" value={form.state} onChange={(e) => set('state', e.target.value)} /></div>
            <div className="field"><label htmlFor="az">Postal code</label><input id="az" className="input" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="aco">Country</label><input id="aco" required className="input" value={form.country} onChange={(e) => set('country', e.target.value)} /></div>
          <label className="checkbox" style={{ marginBottom: 14 }}><input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} /> Set as default delivery address</label>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
        </form>
      )}
    </div>
  );
}
