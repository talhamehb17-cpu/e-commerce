import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { LoginGate } from '@/components/admin/login-gate';

export const metadata = { title: 'Admin sign in', robots: { index: false } };

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect('/admin');
  return <LoginGate />;
}
