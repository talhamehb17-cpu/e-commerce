import { AdminOrderDetail } from '@/components/admin/order-detail';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };
export default async function OrderPage({ params }) {
  const { id } = await params;
  return <AdminOrderDetail id={id} />;
}
