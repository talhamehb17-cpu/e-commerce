import {redirect} from 'next/navigation';
import {getCurrentAdmin,can} from '@/lib/auth';
import {PaymentVerification} from '@/components/admin/payment-verification';
export const dynamic='force-dynamic';
export const metadata={title:'Payment verification'};
export default async function Page(){const admin=await getCurrentAdmin();if(!admin||!can(admin,'orders:read'))redirect('/admin');return <PaymentVerification/>}
