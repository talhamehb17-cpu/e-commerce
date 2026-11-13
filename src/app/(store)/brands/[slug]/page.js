import { notFound } from 'next/navigation';
import { getBrands, listProducts } from '@/lib/catalog';
import { Breadcrumb } from '@/components/ui';
import { ShopGrid } from '@/components/shop';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const brand = (await getBrands()).find((item) => item.slug === slug);
  return { title: brand?.name || 'Brand', description: brand?.description || `Shop ${brand?.name || 'NOVA'} products.`, alternates: { canonical: `/brands/${encodeURIComponent(slug)}` } };
}

export default async function BrandPage({ params }) {
  const { slug } = await params;
  const brands = await getBrands();
  const brand = brands.find((b) => b.slug === slug);
  if (!brand) notFound();
  const { products } = await listProducts({ brand: slug, limit: 24 });
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Brands', href: '/brands' }, { label: brand.name }]} />
          <h1>{brand.name}</h1>
          {brand.description && <p className="muted" style={{ marginTop: 10, maxWidth: 560 }}>{brand.description}</p>}
        </div>
      </div>
      <div className="wrap section-tight">
        <ShopGrid products={products} />
      </div>
    </>
  );
}
