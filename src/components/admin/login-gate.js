'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, Eye, EyeOff } from '../icons';

/**
 * Rendered instead of the dashboard when no admin session exists.
 * The login API creates the session cookie, then we hard-navigate so the
 * server tree re-renders with the authenticated shell.
 */
export function LoginGate() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { setReady(true); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Sign in failed'); setBusy(false); return; }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error — try again.');
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="center" style={{ marginBottom: 26 }}>
          <div className="logo" style={{ fontSize: 24 }}>NOVA</div>
          <div className="eyebrow" style={{ marginTop: 6 }}>Admin portal</div>
        </div>
        <form className="card" onSubmit={submit}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label htmlFor="ae">Email</label>
            <input id="ae" type="email" required autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@yourstore.com" />
          </div>
          <div className="field">
            <label htmlFor="apw">Password</label>
            <div className="password-input-wrap"><input id="apw" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          </div>
          <button className="btn btn-block" disabled={busy || !ready}>
            {busy ? 'Signing in…' : <><Lock size={14} /> Sign in to admin</>}
          </button>
          <p className="muted" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.5, textAlign: 'center' }}>
            The owner account is created during the secure seed/setup step; it has no default password.
          </p>
        </form>
        <div className="center" style={{ marginTop: 16 }}>
          <a href="/" className="link-u" style={{ fontSize: 11 }}>Back to storefront <ArrowRight size={11} style={{ display: 'inline' }} /></a>
        </div>
      </div>
    </div>
  );
}
