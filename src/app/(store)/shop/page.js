import Link from 'next/link';
import { listProducts, getCategories, getBrands } from '@/lib/catalog';
import { Breadcrumb } from '@/components/ui';
import { ShopBrowser } from '@/components/shop-browser';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Shop all products', description: 'Browse every NOVA product across fashion, electronics, home and more.', alternates: { canonical: '/shop' } };

export default async function ShopPage({ searchParams }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1));
  const perPage = 12;
  const params = {
    category: sp.category || undefined,
    brand: sp.brand || undefined,
    sort: sp.sort || 'featured',
    q: sp.q || undefined,
    minPrice: sp.min ? Number(sp.min) : undefined,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    inStock: sp.stock === '1',
    limit: perPage,
    offset: (page - 1) * perPage,
  };

  const [{ products, total }, categories, brands] = await Promise.all([
    listProducts(params),
    getCategories(),
    getBrands(),
  ]);

  const activeCategory = categories.find((c) => c.slug === params.category);

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: activeCategory ? activeCategory.name : 'Shop all' }]} />
          <h1>{activeCategory ? activeCategory.name : sp.q ? `Results for “${sp.q}”` : 'Shop all'}</h1>
          <p className="muted" style={{ marginTop: 10, maxWidth: 560 }}>
            {activeCategory?.description || `${total} products across electronics, fashion, home, beauty, sport and accessories.`}
          </p>
        </div>
      </div>

      <div className="wrap">
        <ShopBrowser
          products={products}
          total={total}
          page={page}
          perPage={perPage}
          categories={categories}
          brands={brands}
          params={{ ...sp, page: undefined }}
        />
      </div>
    </>
  );
}
