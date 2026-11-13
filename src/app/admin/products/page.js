import { sql } from '@/lib/db';
import { AdminProducts } from '@/components/admin/products';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Products' };

export default async function ProductsPage() {
  const [rows, categories, brands] = await Promise.all([
    sql`select p.id, p.name, p.slug, p.subtitle, p.description, p.story, p.sku, p.price, p.compare_at_price, p.cost_price,
          p.stock, p.low_stock_threshold, p.badge, p.is_active, p.is_featured, p.tags, p.material,
          p.category_id, p.brand_id, c.name category_name, b.name brand_name,
          (select coalesce(json_agg(json_build_object('url', pi.url) order by pi.position), '[]'::json) from product_images pi where pi.product_id = p.id) images,
          (select count(*)::int from product_variants v where v.product_id = p.id) variant_count
        from products p left join categories c on c.id = p.category_id left join brands b on b.id = p.brand_id
        order by p.created_at desc limit 60`,
    sql`select id, name, slug from categories order by position`,
    sql`select id, name from brands order by position`,
  ]);
  return <AdminProducts initial={{ products: rows }} categories={categories} brands={brands} />;
}
