import { redirect } from 'next/navigation';
import { getCurrentAdmin, can } from '@/lib/auth';
import { AdminEvents } from '@/components/admin/events';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Events & Promotions' };

export default async function EventsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || !can(admin, 'content:read')) redirect('/admin');
  return <AdminEvents />;
}
