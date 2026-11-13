import Link from 'next/link';
import { getBrands } from '@/lib/catalog';
import { Breadcrumb } from '@/components/ui';

export const metadata = { title: 'Brands' };
export const revalidate = 60;

export default async function BrandsPage() {
  const brands = await getBrands();
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Brands' }]} />
          <h1>Brands we carry</h1>
          <p className="muted" style={{ marginTop: 10, maxWidth: 560 }}>Independent makers and in-house labels, all sampled before they reach the shelf.</p>
        </div>
      </div>
      <div className="wrap section-tight">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {brands.map((b) => (
            <Link key={b.slug} href={`/brands/${b.slug}`} className="card" style={{ display: 'block' }}>
              <h3 style={{ fontSize: 22 }}>{b.name}</h3>
              <p className="muted" style={{ fontSize: 13, marginTop: 6, minHeight: 40 }}>{b.description}</p>
              <span className="link-u" style={{ display: 'inline-block', marginTop: 8 }}>{b.product_count} products</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
