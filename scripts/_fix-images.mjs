import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 2 });
const CAT = {
  electronics: ['/images/products/electronics-headphones-1.jpg', '/images/hero/hero-side.jpg'],
  fashion: ['/images/products/fashion-coat-1.jpg', '/images/hero/hero-main.jpg'],
  shoes: ['/images/products/shoes-sneakers-1.jpg', '/images/hero/hero-side.jpg'],
  home: ['/images/products/home-lamp-1.jpg', '/images/hero/hero-main.jpg'],
  beauty: ['/images/products/beauty-serum-1.jpg', '/images/hero/hero-side.jpg'],
  sports: ['/images/products/sports-yoga-mat-1.jpg', '/images/hero/hero-main.jpg'],
  bags: ['/images/products/bags-tote-1.jpg', '/images/hero/hero-side.jpg'],
};
// Stored image paths that no longer resolve on disk → point them at real files.
await sql`update categories set image_url = '/images/products/electronics-headphones-1.jpg' where image_url like '%electronics-1%'`;
for (const [slug, [primary]] of Object.entries(CAT)) {
  await sql`update categories set image_url = ${primary} where slug = ${slug} and (image_url is null or image_url not like '/images/products/%')`;
}
await sql`update collections set image_url = '/images/hero/hero-side.jpg' where image_url = '/images/hero/hero-main.jpg' and slug in ('gifts-under-15000')`;
await sql`update homepage_sections set image_url = '/images/hero/hero-main.jpg' where image_url = '/images/banners/seasonal-edit.jpg'`;
await sql`update homepage_sections set image_url = '/images/hero/hero-main.jpg' where image_url = '/images/editorial/studio.jpg'`;
await sql`update homepage_sections set config = jsonb_set(config, '{portrait}', '"/images/hero/hero-side.jpg"')
  where config->>'portrait' = '/images/editorial/lifestyle-1.jpg'`;

const rows = await sql`select p.id, p.name, c.slug from products p left join categories c on c.id = p.category_id`;
let fixed = 0;
for (const p of rows) {
  const [primary, alt] = CAT[p.slug] || CAT.electronics;
  await sql`delete from product_images where product_id = ${p.id}`;
  await sql`insert into product_images (product_id, url, alt, position) values
    (${p.id}, ${primary}, ${p.name}, 0), (${p.id}, ${alt}, ${p.name}, 1)`;
  fixed++;
}
const missing = await sql`select count(*)::int n from categories where image_url is null`;
console.log('products re-imaged:', fixed, '| categories without image:', missing[0].n);
await sql.end();
