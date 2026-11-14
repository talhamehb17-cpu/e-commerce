import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { AuthArt, AuthSwitcher } from '@/components/auth-forms';

export const metadata = { title: 'Create account', robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect('/account');
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <AuthSwitcher initialMode="register" />
        </div>
      </div>
      <AuthArt title="Worth keeping." subtitle="Two-year quality promise, 30-day returns and free delivery over Rs 15,000." />
    </div>
  );
}
