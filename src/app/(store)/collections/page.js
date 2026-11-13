import Link from 'next/link';
import Image from 'next/image';
import { getCollections, getCategories } from '@/lib/catalog';
import { Breadcrumb } from '@/components/ui';

export const metadata = { title: 'Collections & departments' };
export const revalidate = 60;

export default async function CollectionsIndex() {
  const [collections, categories] = await Promise.all([getCollections(), getCategories()]);
  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} />
          <h1>Collections</h1>
          <p className="muted" style={{ marginTop: 10, maxWidth: 560 }}>Seasonal edits and departments, each curated by our buying team.</p>
        </div>
      </div>
      <div className="wrap section-tight">
        <h2 style={{ fontSize: 26, marginBottom: 18 }}>Departments</h2>
        <div className="cat-grid cat-7">
          {categories.map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="cat-card">
              <Image src={c.image} alt={c.name} fill sizes="(max-width:720px) 50vw, 15vw" style={{ objectFit: 'cover' }} />
              <small>{c.product_count} items</small>
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
        <h2 style={{ fontSize: 26, margin: '44px 0 18px' }}>Edits</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {collections.map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className="cat-card" style={{ aspectRatio: '4/3' }}>
              <Image src={c.image} alt={c.name} fill sizes="(max-width:720px) 100vw, 30vw" style={{ objectFit: 'cover' }} />
              <small>{c.product_count} products</small>
              <span>{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
