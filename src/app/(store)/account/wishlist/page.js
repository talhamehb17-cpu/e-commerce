import { sql } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/auth';
import { getProductsByIds } from '@/lib/catalog';
import { ShopGrid } from '@/components/shop';
import { Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wishlist' };

export default async function WishlistPage() {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  const rows = await sql`select product_id from wishlists where customer_id = ${customer.id} order by created_at desc`;
  const products = await getProductsByIds(rows.map((r) => r.product_id));
  if (!products.length) return <Empty title="Your wishlist is empty" body="Tap the heart on any product to save it here." cta="Browse products" href="/shop" />;
  return (
    <div>
      <h3 className="serif" style={{ fontSize: 24, marginBottom: 18 }}>{products.length} saved {products.length === 1 ? 'item' : 'items'}</h3>
      <ShopGrid products={products} savedIds={products.map((p) => p.id)} />
    </div>
  );
}
