import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 2 });

const BASE = '/images/products';
// Specific product → [primary, hover image]. Falls back to the category pair.
const MAP = {
  'Aurora Wireless Headphones': ['electronics-headphones-1.jpg', '/images/hero/hero-side.jpg'],
  'Atlas Smartwatch Series 3': ['electronics-smartwatch-1.jpg', '/images/hero/hero-main.jpg'],
  'Quiet Studio Earbuds': ['electronics-earbuds-1.jpg', '/images/hero/hero-side.jpg'],
  'Meridian Bluetooth Speaker': ['electronics-speaker-1.jpg', '/images/hero/hero-main.jpg'],

  'Halden Wool Overcoat': ['fashion-coat-1.jpg', '/images/hero/hero-side.jpg'],
  'Ribbed Merino Crewneck': ['fashion-knit-1.jpg', '/images/hero/hero-main.jpg'],
  'Everyday Poplin Shirt': ['fashion-shirt-1.jpg', '/images/hero/hero-side.jpg'],
  'Cropped Utility Jacket': ['fashion-coat-1.jpg', '/images/hero/hero-main.jpg'],

  'Motion Runner Low': ['shoes-sneakers-1.jpg', '/images/hero/hero-side.jpg'],
  'Court Classic Sneaker': ['shoes-sneakers-1.jpg', '/images/hero/hero-main.jpg'],
  'Terra Trail Boot': ['shoes-boot-1.jpg', '/images/hero/hero-side.jpg'],
  'Slip-On Loafer': ['shoes-loafer-1.jpg', '/images/hero/hero-main.jpg'],

  'Sculpted Ceramic Table Lamp': ['home-lamp-1.jpg', '/images/hero/hero-side.jpg'],
  'Stoneware Dinner Set (4)': ['home-ceramics-1.jpg', '/images/hero/hero-main.jpg'],
  'Linen Bedding Set': ['home-throw-1.jpg', '/images/hero/hero-side.jpg'],
  'Oak Side Table': ['home-table-1.jpg', '/images/hero/hero-main.jpg'],
  'Woven Wool Throw': ['home-throw-1.jpg', '/images/hero/hero-side.jpg'],

  'Balance Hydrating Serum': ['beauty-serum-1.jpg', '/images/hero/hero-side.jpg'],
  'Gentle Cleansing Gel': ['beauty-serum-1.jpg', '/images/hero/hero-main.jpg'],
  'Daily Mineral SPF 50': ['beauty-cream-1.jpg', '/images/hero/hero-side.jpg'],
  'Overnight Repair Cream': ['beauty-cream-1.jpg', '/images/hero/hero-main.jpg'],

  'Pro Grip Yoga Mat': ['sports-yoga-mat-1.jpg', '/images/hero/hero-side.jpg'],
  'Adjustable Dumbbell Pair': ['sports-yoga-mat-1.jpg', '/images/hero/hero-main.jpg'],
  'Trail Running Pack 18L': ['bags-tote-1.jpg', '/images/hero/hero-side.jpg'],
  'Recovery Foam Roller': ['sports-yoga-mat-1.jpg', '/images/hero/hero-main.jpg'],

  'Carry Structured Tote': ['bags-tote-1.jpg', '/images/hero/hero-side.jpg'],
  'Weekender Duffle 45L': ['bags-tote-1.jpg', '/images/hero/hero-main.jpg'],
  'Minimal Card Holder': ['bags-tote-1.jpg', '/images/hero/hero-side.jpg'],
  'Everyday Crossbody': ['bags-tote-1.jpg', '/images/hero/hero-main.jpg'],
  'Canvas Market Tote': ['bags-tote-1.jpg', '/images/hero/hero-side.jpg'],
};

const CATEGORY_COVER = {
  electronics: 'electronics-headphones-1.jpg',
  fashion: 'fashion-coat-1.jpg',
  shoes: 'shoes-sneakers-1.jpg',
  home: 'home-lamp-1.jpg',
  beauty: 'beauty-serum-1.jpg',
  sports: 'sports-yoga-mat-1.jpg',
  bags: 'bags-tote-1.jpg',
};

const products = await sql`select id, name from products`;
let n = 0;
for (const p of products) {
  const entry = MAP[p.name] || ['electronics-headphones-1.jpg', '/images/hero/hero-main.jpg'];
  const primary = entry[0].startsWith('/') ? entry[0] : `${BASE}/${entry[0]}`;
  const secondary = entry[1];
  await sql`delete from product_images where product_id = ${p.id}`;
  await sql`insert into product_images (product_id, url, alt, position) values
    (${p.id}, ${primary}, ${p.name}, 0), (${p.id}, ${secondary}, ${p.name}, 1)`;
  n++;
}

for (const [slug, file] of Object.entries(CATEGORY_COVER)) {
  await sql`update categories set image_url = ${`${BASE}/${file}`} where slug = ${slug}`;
}
// collections get distinct cover crops so they don't all look the same
const COLLECTION_COVERS = {
  'new-arrivals': '/images/hero/hero-side.jpg',
  'best-sellers': '/images/products/electronics-headphones-1.jpg',
  'the-wardrobe-edit': '/images/products/fashion-coat-1.jpg',
  'home-refresh': '/images/products/home-lamp-1.jpg',
  'tech-essentials': '/images/products/electronics-smartwatch-1.jpg',
  'gifts-under-15000': '/images/products/bags-tote-1.jpg',
};
for (const [slug, url] of Object.entries(COLLECTION_COVERS)) {
  await sql`update collections set image_url = ${url} where slug = ${slug}`;
}
console.log('re-imaged products:', n);
await sql.end();
