'use client';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from './toast';
import { useStore } from './providers';
import { Eye, EyeOff } from './icons';

export function AuthArt({ title, subtitle, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
    const onModeChange = (event) => setMode(event.detail === 'register' ? 'register' : 'login');
    window.addEventListener('nova-auth-mode', onModeChange);
    return () => window.removeEventListener('nova-auth-mode', onModeChange);
  }, []);
  const art = mode === 'register'
    ? { title: 'Make it yours.', subtitle: 'Create an account to save favourites and keep your orders together.' }
    : { title, subtitle };
  return (
    <aside className="auth-art" data-mode={mode} aria-live="polite">
      <Image className="auth-art-image" data-visible={mode === 'login'} src="/images/hero/hero-main.jpg" alt="" fill priority sizes="(max-width: 760px) 100vw, 50vw" />
      <Image className="auth-art-image" data-visible={mode === 'register'} src="/images/hero/hero-side.jpg" alt="" fill sizes="(max-width: 760px) 100vw, 50vw" />
      <div className="auth-art-cap" key={mode}>
        <h3>{art.title}</h3>
        <p>{art.subtitle}</p>
      </div>
    </aside>
  );
}

export function AuthSwitcher({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const switchTo = (next) => {
    setMode(next);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nova-auth-mode', { detail: next }));
  };
  const isLogin = mode === 'login';
  return (
    <div className="auth-switcher">
      <div className="auth-mode-toggle" role="tablist" aria-label="Account access">
        <span className="auth-mode-indicator" data-mode={mode} aria-hidden="true" />
        <button type="button" role="tab" id="auth-tab-login" aria-selected={isLogin} aria-controls="auth-panel-login" tabIndex={isLogin ? 0 : -1} onClick={() => switchTo('login')}>Sign in</button>
        <button type="button" role="tab" id="auth-tab-register" aria-selected={!isLogin} aria-controls="auth-panel-register" tabIndex={!isLogin ? 0 : -1} onClick={() => switchTo('register')}>Create account</button>
      </div>
      <div className="auth-form-stage">
        <section id="auth-panel-login" className="auth-form-panel" data-active={isLogin} role="tabpanel" aria-labelledby="auth-tab-login" aria-hidden={!isLogin} inert={!isLogin}>
          <div className="eyebrow">Welcome back</div>
          <h1>Sign in</h1>
          <p className="sub">Track orders, save items and check out faster.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 260 }} />}><LoginForm onSwitch={() => switchTo('register')} /></Suspense>
        </section>
        <section id="auth-panel-register" className="auth-form-panel" data-active={!isLogin} role="tabpanel" aria-labelledby="auth-tab-register" aria-hidden={isLogin} inert={isLogin}>
          <div className="eyebrow">Join the list</div>
          <h1>Create account</h1>
          <p className="sub">Faster checkout, order tracking and early access to new arrivals.</p>
          <RegisterForm onSwitch={() => switchTo('login')} />
        </section>
      </div>
    </div>
  );
}

export function LoginForm({ onSwitch }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/account';
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not sign in'); return; }
      const firstName = data.customer?.name?.split(' ')[0] || 'back';
      toast(`Welcome ${firstName === 'back' ? 'back' : `back, ${firstName}`}`);
      if (data.customer?.verified === false) setNeedsVerify(true);
      let target = '/account';
      try {
        const parsed = new URL(next, window.location.origin);
        if (parsed.origin === window.location.origin) target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch { /* fall back to the account page for malformed return URLs */ }
      router.push(target);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      {needsVerify && <div className="alert info">Your email is not verified yet — check your inbox for the code.</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="password-input-wrap"><input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <label className="checkbox"><input type="checkbox" defaultChecked /> Remember me</label>
        <Link href="/forgot-password" style={{ fontSize: 12.5, color: 'var(--accent)' }}>Forgot password?</Link>
      </div>
      <button className="btn btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="auth-alt">New here? <button type="button" onClick={onSwitch}>Create an account</button></p>
    </form>
  );
}

export function RegisterForm({ onSwitch }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', marketing: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form'); // form → otp
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not create account'); return; }
      toast('Account created — verify your email');
      setStep('otp');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, purpose: 'verify_email' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not resend code'); return; }
      toast('A new verification code has been sent');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code, purpose: 'verify_email' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not verify'); return; }
      toast('Email verified');
      router.push('/account');
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'otp') {
    return (
      <form onSubmit={verify}>
        {error && <div className="alert error">{error}</div>}
        <div className="alert info">We emailed a 6-digit code to <strong>{form.email}</strong>. It expires in 10 minutes.</div>
        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input id="code" inputMode="numeric" maxLength={6} required className="input otp-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
        </div>
        <button className="btn btn-block" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify email'}</button>
        <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 10 }} onClick={resendCode} disabled={busy}>
          Resend code
        </button>
        <p className="auth-alt"><Link href="/account">Skip for now</Link></p>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="remail">Email</label>
        <input id="remail" type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="rpassword">Password</label>
        <div className="password-input-wrap"><input id="rpassword" type={showPassword ? 'text' : 'password'} required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      </div>
      <label className="checkbox" style={{ marginBottom: 18 }}>
        <input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} />
        Email me new arrivals and editor picks. One email a week.
      </label>
      <button className="btn btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      <p className="auth-alt">Already have an account? <button type="button" onClick={onSwitch}>Sign in</button></p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not send a reset code'); return; }
      setSent(true);
      toast('If that account exists, a code is on its way');
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      {sent ? (
        <>
          <div className="alert ok">Check your inbox for a 6-digit reset code.</div>
          <Link className="btn btn-block" href={`/reset-password?email=${encodeURIComponent(email)}`}>Enter reset code</Link>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="femail">Email</label>
            <input id="femail" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
          <p className="auth-alt"><Link href="/login">Back to sign in</Link></p>
        </>
      )}
    </form>
  );
}

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: params.get('email') || '', code: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not reset password'); return; }
    setDone(true);
    toast('Password reset — please sign in');
  }
  if (done) {
    return (
      <>
        <div className="alert ok">Your password has been updated.</div>
        <Link className="btn btn-block" href="/login">Sign in</Link>
      </>
    );
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <div className="field">
        <label htmlFor="remail2">Email</label>
        <input id="remail2" type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="rcode">Reset code</label>
        <input id="rcode" inputMode="numeric" maxLength={6} required className="input otp-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })} placeholder="000000" />
      </div>
      <div className="field">
        <label htmlFor="rnp">New password</label>
        <div className="password-input-wrap"><input id="rnp" type={showPassword ? 'text' : 'password'} required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      </div>
      <button className="btn btn-block" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button>
      <p className="auth-alt"><Link href="/forgot-password">Need a new code?</Link></p>
    </form>
  );
}
