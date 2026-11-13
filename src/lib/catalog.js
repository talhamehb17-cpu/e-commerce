import { sql, cached } from './db.js';

const IMG = {
  electronics: '/images/products/electronics-headphones-1.jpg',
  watch: '/images/products/electronics-smartwatch-1.jpg',
  headphones: '/images/products/electronics-headphones-1.jpg',
  fashion: '/images/products/fashion-coat-1.jpg',
  coat: '/images/products/fashion-coat-1.jpg',
  shoes: '/images/products/shoes-sneakers-1.jpg',
  sneakers: '/images/products/shoes-sneakers-1.jpg',
  home: '/images/products/home-lamp-1.jpg',
  lamp: '/images/products/home-lamp-1.jpg',
  beauty: '/images/products/beauty-serum-1.jpg',
  serum: '/images/products/beauty-serum-1.jpg',
  sports: '/images/products/sports-yoga-mat-1.jpg',
  yoga: '/images/products/sports-yoga-mat-1.jpg',
  bags: '/images/products/bags-tote-1.jpg',
  tote: '/images/products/bags-tote-1.jpg',
  heroMain: '/images/hero/hero-main.jpg',
  heroSide: '/images/hero/hero-side.jpg',
};
const CATEGORY_IMAGES = {
  electronics: IMG.electronics,
  fashion: IMG.fashion,
  shoes: IMG.shoes,
  home: IMG.home,
  beauty: IMG.beauty,
  sports: IMG.sports,
  bags: IMG.bags,
};

/** Resolve a stored image path, falling back to a category-appropriate stock shot. */
export function resolveImage(url, categorySlug, index = 0) {
  const base = CATEGORY_IMAGES[categorySlug] || IMG.heroMain;
  if (!url) {
    if (index === 0) return base;
    const alts = [IMG.heroMain, IMG.heroSide, base];
    return alts[(index - 1) % alts.length];
  }
  if (url.startsWith('/images/products/ring') || url.startsWith('/images/products/necklace')
    || url.startsWith('/images/products/bracelet') || url.startsWith('/images/products/earrings')
    || url.startsWith('/images/products/celeste')) {
    // legacy jewellery paths that no longer exist on disk
    return index === 0 ? base : IMG.heroMain;
  }
  if (url === '/images/products/electronics-1.jpg') return IMG.electronics;
  if (url === '/images/editorial/lifestyle-1.jpg') return IMG.heroSide;
  if (url === '/images/editorial/studio.jpg') return IMG.heroMain;
  if (url === '/images/banners/seasonal-edit.jpg') return IMG.heroMain;
  return url;
}

const PRODUCT_COLUMNS = sql`
  p.id, p.slug, p.name, p.subtitle, p.price, p.compare_at_price, p.stock, p.badge,
  p.is_featured, p.rating_avg, p.rating_count, p.sold_count, p.created_at, p.material,
  c.slug as category_slug, c.name as category_name,
  (select url from product_images pi where pi.product_id = p.id order by position limit 1) as image,
  (select url from product_images pi where pi.product_id = p.id order by position offset 1 limit 1) as image2,
  (select count(*)::int from product_variants v where v.product_id = p.id) as variant_count
`;

export async function listProducts({
  category,
  collection,
  featured,
  badge,
  sort = 'featured',
  q,
  minPrice,
  maxPrice,
  inStock,
  limit = 12,
  offset = 0,
  includeInactive = false,
} = {}) {
  const where = [];
  if (!includeInactive) where.push(sql`p.is_active = true`);
  if (category) where.push(sql`c.slug = ${category}`);
  if (featured) where.push(sql`p.is_featured = true`);
  if (badge === 'new') where.push(sql`p.badge = 'new'`);
  if (badge === 'bestseller') where.push(sql`p.badge = 'bestseller'`);
  if (badge === 'limited') where.push(sql`p.badge = 'limited'`);
  if (inStock) where.push(sql`p.stock > 0`);
  if (minPrice != null) where.push(sql`p.price >= ${Math.round(minPrice * 100)}`);
  if (maxPrice != null) where.push(sql`p.price <= ${Math.round(maxPrice * 100)}`);
  if (q) {
    const term = `%${q}%`;
    where.push(sql`(p.name ilike ${term} or p.subtitle ilike ${term} or p.description ilike ${term} or ${q} = any(p.tags))`);
  }
  if (collection) {
    where.push(sql`exists (select 1 from collection_products cp join collections co on co.id = cp.collection_id where cp.product_id = p.id and co.slug = ${collection})`);
  }
  const filter = where.length ? sql`where ${where.reduce((a, b) => sql`${a} and ${b}`)}` : sql``;

  const order =
    sort === 'price-asc' ? sql`p.price asc`
    : sort === 'price-desc' ? sql`p.price desc`
    : sort === 'newest' ? sql`p.created_at desc`
    : sort === 'bestselling' ? sql`p.sold_count desc, p.rating_count desc`
    : sort === 'rating' ? sql`p.rating_avg desc, p.rating_count desc`
    : sql`p.is_featured desc, p.sold_count desc, p.created_at desc`;

  const rows = await sql`
    select ${PRODUCT_COLUMNS} from products p
    left join categories c on c.id = p.category_id
    ${filter}
    order by ${order}
    limit ${limit} offset ${offset}
  `;
  const countRows = await sql`
    select count(*)::int n from products p left join categories c on c.id = p.category_id ${filter}
  `;
  return { products: rows.map(shapeProduct), total: countRows[0].n };
}

export function shapeProduct(r) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    price: Number(r.price),
    compareAtPrice: r.compare_at_price == null ? null : Number(r.compare_at_price),
    stock: r.stock,
    badge: r.badge,
    featured: r.is_featured,
    rating: Number(r.rating_avg),
    ratingCount: r.rating_count,
    sold: r.sold_count,
    material: r.material,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
    image: resolveImage(r.image, r.category_slug, 0),
    image2: resolveImage(r.image2, r.category_slug, 1),
    variantCount: r.variant_count ?? 0,
    createdAt: r.created_at,
  };
}

export async function getProductBySlug(slug) {
  const rows = await sql`
    select p.*, c.slug as category_slug, c.name as category_name
    from products p left join categories c on c.id = p.category_id
    where p.slug = ${slug} limit 1
  `;
  const p = rows[0];
  if (!p) return null;
  const [images, variants, related, reviews] = await Promise.all([
    sql`select id, url, alt, position from product_images where product_id = ${p.id} order by position`,
    sql`select id, name, option_name, price_delta, sku, stock, position from product_variants where product_id = ${p.id} order by position`,
    sql`select ${PRODUCT_COLUMNS} from products p left join categories c on c.id = p.category_id
        where p.is_active and p.id <> ${p.id} and (p.category_id = ${p.category_id} or p.is_featured)
        order by (p.category_id = ${p.category_id}) desc, p.sold_count desc limit 4`,
    getProductReviews(p.id, 6),
  ]);
  const gallery = images.length
    ? images.map((i) => ({ ...i, url: resolveImage(i.url, p.category_slug, i.position) }))
    : [
        { url: resolveImage(null, p.category_slug, 0), alt: p.name },
        { url: resolveImage(null, p.category_slug, 1), alt: p.name },
        { url: resolveImage(null, p.category_slug, 2), alt: p.name },
      ];
  return {
    ...shapeProduct({ ...p, image: gallery[0].url, image2: gallery[1]?.url }),
    description: p.description,
    story: p.story,
    sku: p.sku,
    lowStockThreshold: p.low_stock_threshold,
    costPrice: p.cost_price,
    tags: p.tags,
    gallery,
    variants: variants.map((v) => ({ ...v, priceDelta: Number(v.price_delta) })),
    related: related.map(shapeProduct),
    reviews,
    isActive: p.is_active,
  };
}

export async function getProductReviews(productId, limit = 50, sort = 'recent', rating = 0) {
  const ratingFilter = rating ? sql`and r.rating = ${rating}` : sql``;
  const order = sort === 'highest' ? sql`r.rating desc, r.created_at desc`
    : sort === 'lowest' ? sql`r.rating asc, r.created_at desc`
    : sort === 'helpful' ? sql`r.helpful_count desc, r.created_at desc`
    : sql`r.created_at desc`;
  const rows = await sql`
    select r.id, r.rating, r.title, r.body, r.images, r.is_verified, r.helpful_count, r.created_at, r.customer_id,
           cu.name as customer_name, cu.avatar_url
    from reviews r join customers cu on cu.id = r.customer_id
    where r.product_id = ${productId} and r.is_approved ${ratingFilter}
    order by ${order} limit ${limit}
  `;
  const dist = await sql`
    select rating, count(*)::int n from reviews where product_id = ${productId} and is_approved group by rating
  `;
  const avg = await sql`
    select coalesce(avg(rating),0)::numeric(3,2) a, count(*)::int n from reviews where product_id = ${productId} and is_approved
  `;
  return {
    items: rows,
    distribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: dist.find((d) => d.rating === r)?.n || 0 })),
    average: Number(avg[0].a),
    total: avg[0].n,
  };
}

export async function getCategories(activeOnly = true) {
  return cached('categories:' + activeOnly, 30_000, async () => {
    const rows = await sql`
      select c.id, c.slug, c.name, c.description, c.image_url, c.position,
        (select count(*)::int from products p where p.category_id = c.id and p.is_active) as product_count
      from categories c ${activeOnly ? sql`where c.is_active` : sql``} order by c.position, c.name
    `;
    return rows.map((r) => ({ ...r, image: resolveImage(r.image_url, r.slug) }));
  });
}

export async function getCollections(activeOnly = true) {
  return cached('collections:' + activeOnly, 30_000, async () => {
    const rows = await sql`
      select co.id, co.slug, co.name, co.description, co.image_url, co.is_featured, co.position,
        (select count(*)::int from collection_products cp where cp.collection_id = co.id) as product_count
      from collections co ${activeOnly ? sql`where co.is_active` : sql``} order by co.position, co.name
    `;
    return rows.map((r) => ({ ...r, image: r.image_url || '/images/editorial/lifestyle-1.jpg' }));
  });
}

export async function getBrands(activeOnly = true) {
  return cached('brands:' + activeOnly, 30_000, async () => {
    const rows = await sql`
      select b.id, b.slug, b.name, b.description, b.logo_url, b.website, b.is_featured, b.position,
        (select count(*)::int from products p where p.brand_id = b.id and p.is_active) as product_count
      from brands b ${activeOnly ? sql`where b.is_active` : sql``} order by b.position, b.name
    `;
    return rows.map((r) => ({ ...r, logo: r.logo_url }));
  });
}

export async function getBrandBySlug(slug) {
  const rows = await sql`
    select b.*, (select count(*)::int from products p where p.brand_id = b.id and p.is_active) as product_count
    from brands b where b.slug = ${slug} limit 1`;
  return rows[0] || null;
}

export async function getCollectionBySlug(slug) {
  const rows = await sql`
    select co.*, (select count(*)::int from collection_products cp where cp.collection_id = co.id) as product_count
    from collections co where co.slug = ${slug} limit 1`;
  return rows[0] || null;
}

export async function getCollectionProducts(collectionId, limit = 24) {
  const rows = await sql`
    select ${PRODUCT_COLUMNS} from products p
    join collection_products cp on cp.product_id = p.id
    left join categories c on c.id = p.category_id
    where cp.collection_id = ${collectionId} and p.is_active
    order by cp.position, p.created_at desc limit ${limit}`;
  return rows.map(shapeProduct);
}

export async function getFeaturedReviews(limit = 3) {
  return sql`
    select r.id, r.rating, r.title, r.body, r.created_at, r.is_verified,
           cu.name as customer_name, cu.avatar_url, p.name as product_name, p.slug as product_slug
    from reviews r join customers cu on cu.id = r.customer_id join products p on p.id = r.product_id
    where r.is_approved and r.is_featured
    order by r.rating desc, r.created_at desc limit ${limit}
  `;
}

export async function getHomepageSections() {
  return cached('home-sections', 20_000, async () => {
    const rows = await sql`select * from homepage_sections where is_active order by position`;
    return rows;
  });
}

export async function searchSuggestions(q, limit = 6) {
  if (!q || q.trim().length < 2) return { products: [], categories: [] };
  const term = `%${q.trim()}%`;
  const [products, categories] = await Promise.all([
    sql`select ${PRODUCT_COLUMNS} from products p left join categories c on c.id = p.category_id
        where p.is_active and (p.name ilike ${term} or p.subtitle ilike ${term})
        order by p.is_featured desc limit ${limit}`,
    sql`select slug, name from categories where name ilike ${term} limit 4`,
  ]);
  return { products: products.map(shapeProduct), categories };
}

export async function getProductsByIds(ids) {
  if (!ids?.length) return [];
  const rows = await sql`
    select ${PRODUCT_COLUMNS} from products p left join categories c on c.id = p.category_id
    where p.id = any(${ids}::uuid[]) and p.is_active
  `;
  return rows.map(shapeProduct);
}

export async function getProductsBySlugs(slugs) {
  if (!slugs?.length) return [];
  const rows = await sql`
    select ${PRODUCT_COLUMNS} from products p left join categories c on c.id = p.category_id
    where p.slug = any(${slugs}::text[]) and p.is_active
  `;
  return rows.map(shapeProduct);
}
