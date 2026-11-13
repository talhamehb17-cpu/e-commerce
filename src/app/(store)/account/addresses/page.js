import { sql } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/auth';
import { AddressManager } from '@/components/address-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Addresses' };

export default async function AddressesPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  const addresses = await sql`select * from addresses where customer_id = ${customer.id} order by is_default_shipping desc, created_at desc`;
  return <AddressManager initial={addresses} />;
}
