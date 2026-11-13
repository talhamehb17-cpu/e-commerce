import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { AuthArt, RegisterForm } from '@/components/auth-forms';

export const metadata = { title: 'Create account', robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect('/account');
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="eyebrow">Join the list</div>
          <h1>Create account</h1>
          <p className="sub">Faster checkout, order tracking and early access to new arrivals.</p>
          <RegisterForm />
        </div>
      </div>
      <AuthArt title="Worth keeping." subtitle="Two-year quality promise, 30-day returns and free delivery over Rs 15,000." />
    </div>
  );
}
