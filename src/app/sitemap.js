import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://nova-commerce-eight.vercel.app');
const staticRoutes = ['', '/shop', '/about', '/contact', '/policies/faq', '/policies/shipping', '/policies/returns', '/policies/privacy', '/policies/terms'];

export default async function sitemap() {
  const base = siteUrl.replace(/\/$/, '');
  const entries = staticRoutes.map((route) => ({ url: `${base}${route}`, changeFrequency: route === '' ? 'daily' : 'weekly', priority: route === '' ? 1 : 0.6 }));
  try {
    const [products, categories, collections, brands] = await Promise.all([
      sql`select slug, updated_at from products where is_active order by updated_at desc`,
      sql`select slug, created_at as updated_at from categories where is_active`,
      sql`select slug, created_at as updated_at from collections where is_active`,
      sql`select slug, created_at as updated_at from brands where is_active`,
    ]);
    for (const row of products) entries.push({ url: `${base}/products/${encodeURIComponent(row.slug)}`, lastModified: row.updated_at || undefined, changeFrequency: 'weekly', priority: 0.7 });
    for (const row of categories) entries.push({ url: `${base}/collections/${encodeURIComponent(row.slug)}`, lastModified: row.updated_at || undefined, changeFrequency: 'weekly', priority: 0.6 });
    for (const row of collections) entries.push({ url: `${base}/collections/${encodeURIComponent(row.slug)}`, lastModified: row.updated_at || undefined, changeFrequency: 'weekly', priority: 0.7 });
    for (const row of brands) entries.push({ url: `${base}/brands/${encodeURIComponent(row.slug)}`, lastModified: row.updated_at || undefined, changeFrequency: 'weekly', priority: 0.5 });
  } catch (error) {
    console.error('Sitemap catalog query failed:', error?.message || 'unknown error');
  }
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
