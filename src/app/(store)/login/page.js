import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { AuthArt, LoginForm } from '@/components/auth-forms';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect('/account');
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">Welcome back</div>
          <h1>Sign in</h1>
          <p className="sub">Track orders, save items and check out faster.</p>
          <Suspense fallback={<div className="skeleton" style={{ height: 260 }} />}><LoginForm /></Suspense>
        </div>
      </div>
      <AuthArt title="Everything, considered." subtitle="One account for orders across electronics, wardrobe, home and everyday carry." />
    </div>
  );
}
