import { ForgotForm } from '@/components/auth-forms';

export const metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function ForgotPage() {
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">Account recovery</div>
          <h1>Forgot password</h1>
          <p className="sub">Enter your email and we will send a 6-digit reset code.</p>
          <ForgotForm />
        </div>
      </div>
      <div className="auth-art" style={{ background: 'var(--surface2)' }} />
    </div>
  );
}
