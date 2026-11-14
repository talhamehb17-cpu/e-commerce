import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { AuthArt, AuthSwitcher } from '@/components/auth-forms';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect('/account');
  return (
    <div className="auth-shell">
      <div className="auth-form-wrap">
        <div className="auth-card">
          <AuthSwitcher initialMode="login" />
        </div>
      </div>
      <AuthArt initialMode="login" title="Everything, considered." subtitle="Sign in to revisit saved items and review your orders." />
    </div>
  );
}
