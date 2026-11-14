import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { EmailConfiguration } from '@/components/admin/email-configuration';
export const dynamic='force-dynamic';
export const metadata={title:'Email configuration'};
export default async function Page(){const admin=await getCurrentAdmin();if(admin?.role!=='owner')redirect('/admin');return <EmailConfiguration/>}
