'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from './providers';
import { toast } from './toast';
import { Check } from './icons';

export function AccountSettings({ customer, currencies, themes, allowOverride, storePalette }) {
  const router = useRouter();
  const { setTheme } = useStore();
  const [profile, setProfile] = useState({ name: customer.name, phone: customer.phone || '' });
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { toast(data.error || 'Could not save', 'error'); return; }
    toast('Profile updated');
    router.refresh();
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) { toast('New passwords do not match', 'error'); return; }
    setPwdBusy(true);
    const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: pwd.current, next: pwd.next }) });
    const data = await res.json();
    setPwdBusy(false);
    if (!res.ok) { toast(data.error || 'Could not change password', 'error'); return; }
    setPwd({ current: '', next: '', confirm: '' });
    toast('Password changed');
  }

  async function setCurrency(code) {
    const res = await fetch('/api/account/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: code }) });
    if (res.ok) { toast('Currency preference saved'); router.refresh(); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <form className="card" onSubmit={saveProfile}>
        <h3 style={{ fontSize: 19, marginBottom: 14 }}>Profile</h3>
        <div className="form-row">
          <div className="field"><label htmlFor="sn">Name</label><input id="sn" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="sp">Phone</label><input id="sp" className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" value={customer.email} disabled />
          <span className="muted" style={{ fontSize: 11 }}>{customer.verified ? 'Verified' : 'Not verified — check your inbox for the code'}</span>
        </div>
        <button className="btn btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      <form className="card" onSubmit={changePassword}>
        <h3 style={{ fontSize: 19, marginBottom: 14 }}>Password</h3>
        <div className="field"><label htmlFor="pc">Current password</label><input id="pc" type="password" required className="input" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></div>
        <div className="form-row">
          <div className="field"><label htmlFor="pn">New password</label><input id="pn" type="password" required minLength={8} className="input" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></div>
          <div className="field"><label htmlFor="pcn">Confirm new password</label><input id="pcn" type="password" required minLength={8} className="input" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></div>
        </div>
        <button className="btn btn-sm" disabled={pwdBusy}>{pwdBusy ? 'Updating…' : 'Change password'}</button>
      </form>

      <div className="card">
        <h3 style={{ fontSize: 19, marginBottom: 6 }}>Display currency</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Prices convert for display. All orders settle in PKR.</p>
        <div className="chips">
          {currencies.map((c) => (
            <button key={c.code} className="chip" data-on={customer.currency === c.code ? 'true' : 'false'} onClick={() => setCurrency(c.code)}>
              {c.code} · {c.symbol}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 19, marginBottom: 6 }}>Appearance</h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          {allowOverride ? `Personal palette overrides the store default (${storePalette}) for your account only.` : 'The store owner has disabled personal palettes.'}
        </p>
        {allowOverride && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {themes.map((t) => (
              <button
                key={t.slug} onClick={() => setTheme(t.slug)}
                style={{ display: 'flex', gap: 9, alignItems: 'center', padding: 11, borderRadius: 10, border: `1px solid ${customer.theme === t.slug ? 'var(--ink)' : 'var(--line)'}`, background: 'var(--surface)', textAlign: 'left' }}
              >
                <span style={{ display: 'flex' }}>
                  {(Array.isArray(t.swatch) ? t.swatch : ['#f7f2ea', '#c8a96a', '#16130f']).map((c, i) => (
                    <i key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: c, marginLeft: i ? -3 : 0, border: '1px solid rgba(0,0,0,.12)' }} />
                  ))}
                </span>
                <span style={{ fontSize: 12, flex: 1 }}>{t.name}</span>
                {customer.theme === t.slug && <Check size={12} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
            {customer.theme && (
              <button onClick={() => setTheme(null)} className="btn btn-outline btn-sm" style={{ alignSelf: 'center' }}>Use store default</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
