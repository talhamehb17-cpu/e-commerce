import Link from 'next/link';
import { getCurrentCustomer } from '@/lib/auth';
import { loadCart } from '@/lib/cart';
import { Breadcrumb } from '@/components/ui';
import { CartView } from '@/components/cart-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your bag' };

export default async function CartPage() {
  const customer = await getCurrentCustomer();
  const { items, totals } = await loadCart(customer?.id || null);
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Bag' }]} />
          <h1>Your bag</h1>
        </div>
      </div>
      <div className="wrap">
        <CartView items={items} totals={totals} />
      </div>
    </>
  );
}
