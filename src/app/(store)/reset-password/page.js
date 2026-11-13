import { Suspense } from 'react';
import { ResetForm } from '@/components/auth-forms';

export const metadata = { title: 'Set a new password' };

export default function ResetPage() {
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">Account recovery</div>
          <h1>Set a new password</h1>
          <p className="sub">Enter the code we emailed you, then choose a new password.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 300 }} />}><ResetForm /></Suspense>
        </div>
      </div>
      <div className="auth-art" style={{ background: 'var(--surface2)' }} />
    </div>
  );
}
