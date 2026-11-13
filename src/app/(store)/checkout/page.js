import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/lib/auth';
import { loadCart } from '@/lib/cart';
import { getSetting } from '@/lib/settings';
import { getCurrencies } from '@/lib/currency';
import { sql } from '@/lib/db';
import { CheckoutForm } from '@/components/checkout-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  const { items, totals } = await loadCart(customer?.id || null);
  if (!items.length) redirect('/cart');

  const [payments, currencies, addresses] = await Promise.all([
    getSetting('payments'),
    getCurrencies(),
    customer ? sql`select * from addresses where customer_id = ${customer.id} order by is_default_shipping desc, created_at desc limit 5` : [],
  ]);

  return (
    <div className="wrap checkout-layout">
      <CheckoutForm
        items={items}
        totals={totals}
        customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone, currency: customer.currency } : null}
        addresses={addresses}
        payments={payments}
        currencies={currencies}
        defaultCurrency={customer?.currency || currencies.find((c) => c.isDefault)?.code || 'PKR'}
      />
    </div>
  );
}
