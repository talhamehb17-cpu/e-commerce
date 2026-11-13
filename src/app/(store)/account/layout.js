import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { AccountNav } from '@/components/account-nav';

export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?next=/account');
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <div className="eyebrow">My account</div>
          <h1 style={{ fontSize: 'clamp(26px,3.4vw,40px)', marginTop: 8 }}>Hello, {customer.name.split(' ')[0]}</h1>
          {!customer.email_verified && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Your email is not verified yet — check your inbox for the code.</p>
          )}
        </div>
      </div>
      <div className="wrap account-layout">
        <AccountNav />
        <div>{children}</div>
      </div>
    </>
  );
}
