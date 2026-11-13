import { notFound } from 'next/navigation';
import { getProductBySlug, listProducts } from '@/lib/catalog';
import { getCurrencies } from '@/lib/currency';
import { getCurrentCustomer } from '@/lib/auth';
import { sql } from '@/lib/db';
import { ProductDetail } from '@/components/product-detail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.name,
    description: product.subtitle || product.description?.slice(0, 155),
    openGraph: { images: [product.image], title: product.name, description: product.subtitle || '' },
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.isActive) notFound();

  const [customer, currencies, related] = await Promise.all([
    getCurrentCustomer(),
    getCurrencies(),
    listProducts({ category: product.categorySlug, limit: 5 }),
  ]);

  let savedId = null;
  let myReview = null;
  let canReview = false;
  if (customer) {
    const [w, r, purchased] = await Promise.all([
      sql`select id from wishlists where customer_id = ${customer.id} and product_id = ${product.id}`,
      sql`select id, rating, title, body, images, is_verified, created_at from reviews where customer_id = ${customer.id} and product_id = ${product.id}`,
      sql`select 1 from orders o join order_items oi on oi.order_id = o.id where o.customer_id = ${customer.id} and oi.product_id = ${product.id} and o.status <> 'cancelled' limit 1`,
    ]);
    savedId = w[0]?.id ? product.id : null;
    myReview = r[0] || null;
    canReview = Boolean(purchased[0]);
  }

  return (
    <ProductDetail
      product={product}
      related={related.products.filter((p) => p.id !== product.id).slice(0, 4)}
      saved={Boolean(savedId)}
      customer={customer ? { id: customer.id, name: customer.name } : null}
      myReview={myReview}
      verifiedPurchase={canReview}
      currencyDefault={customer?.currency || currencies.find((c) => c.isDefault)?.code || 'PKR'}
    />
  );
}
