import { redirect } from 'next/navigation';
import { getCurrentAdmin, can } from '@/lib/auth';
import { AnalyticsPage } from '@/components/admin/analytics-page';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };
export default async function Page() {
  const admin=await getCurrentAdmin();
  if(!admin||!can(admin,'dashboard:read'))redirect('/admin');
  return <AnalyticsPage />;
}
