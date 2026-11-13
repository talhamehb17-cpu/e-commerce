import { notFound } from 'next/navigation';
import { listProducts, getCollections, getCategories } from '@/lib/catalog';
import { Breadcrumb } from '@/components/ui';
import { ShopBrowser } from '@/components/shop-browser';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const title = slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return { title: `${title} · NOVA` };
}

export default async function CollectionPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const [collections, categories] = await Promise.all([getCollections(), getCategories()]);
  const collection = collections.find((c) => c.slug === slug);
  const category = categories.find((c) => c.slug === slug);
  if (!collection && !category) notFound();

  const page = Math.max(1, Number(sp.page || 1));
  const perPage = 12;
  const isCategory = Boolean(category) && !collection;
  const { products, total } = await listProducts({
    ...(isCategory ? { category: slug } : { collection: slug }),
    sort: sp.sort || 'featured',
    brand: sp.brand || undefined,
    q: sp.q || undefined,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    inStock: sp.stock === '1',
    limit: perPage,
    offset: (page - 1) * perPage,
  });

  const title = collection?.name || category?.name;
  const description = collection?.description || category?.description;

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: isCategory ? 'Departments' : 'Collections', href: '/collections' }, { label: title }]} />
          <h1>{title}</h1>
          {description && <p className="muted" style={{ marginTop: 10, maxWidth: 600 }}>{description}</p>}
          <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>{total} products</p>
        </div>
      </div>
      <div className="wrap">
        <ShopBrowser
          products={products} total={total} page={page} perPage={perPage}
          categories={categories} brands={[]} params={{ ...sp, page: undefined }}
          basePath={`/collections/${slug}`}
        />
      </div>
    </>
  );
}
