import postgres from 'postgres';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:55432/postgres';
const sql = postgres(url, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require', onnotice: () => {} });
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/* ------------------------------------------------------------------
   Categories, brands, products — general multi-category merchandise.
   Image keys map to the photography shipped in /public/images.
------------------------------------------------------------------ */
const CATEGORIES = [
  ['electronics', 'Electronics', 'Audio, wearables and everyday tech.', 'electronics-headphones-1', true],
  ['fashion', 'Fashion', 'Outerwear, knitwear and wardrobe staples.', 'fashion-coat-1', true],
  ['shoes', 'Shoes', 'Sneakers, boots and refined everyday footwear.', 'shoes-sneakers-1', true],
  ['home', 'Home & Living', 'Lighting, ceramics and textiles for slow living.', 'home-lamp-1', true],
  ['beauty', 'Beauty', 'Skincare and self-care, formulated simply.', 'beauty-serum-1', true],
  ['sports', 'Sports & Fitness', 'Training gear built for daily movement.', 'sports-yoga-mat-1', true],
  ['bags', 'Bags & Accessories', 'Leather goods and carry essentials.', 'bags-tote-1', true],
];

const BRANDS = [
  ['northline', 'Northline', 'Considered tech and audio.', true],
  ['atlas', 'Atlas Studio', 'Modern wardrobe staples.', true],
  ['verve', 'Verve', 'Everyday sneakers and footwear.', false],
  ['terracotta', 'Terracotta', 'Objects and lighting for the home.', true],
  ['lumen', 'Lumen Skin', 'Simple, effective skincare.', true],
  ['altitude', 'Altitude', 'Training and outdoor gear.', false],
  ['carry', 'Carry Co.', 'Leather bags and small goods.', false],
];

// [name, category, brand, price(PKR), compareAt, stock, badge, featured, material, subtitle, description]
const PRODUCTS = [
  ['Aurora Wireless Headphones', 'electronics', 'northline', 42900, 49900, 34, 'bestseller', true, 'Matte aluminium · vegan leather', 'Adaptive noise cancelling, 40-hour battery',
    'Aurora pairs a 40mm beryllium-coated driver with adaptive noise cancelling that reads the room 200 times a second. Memory-foam cushions distribute pressure evenly, so the third hour feels like the first. Fast charge gives five hours from ten minutes.'],
  ['Atlas Smartwatch Series 3', 'electronics', 'northline', 64900, null, 21, 'new', true, 'Stainless steel · woven nylon', 'Always-on display, 9-day battery',
    'A titanium-grade case with a sapphire crystal face and a display that never sleeps. Health tracking covers sleep stages, heart rate variability and 40 workout modes. Swappable 20mm straps.'],
  ['Quiet Studio Earbuds', 'electronics', 'northline', 21900, 25900, 58, 'bestseller', false, 'Recycled polycarbonate', 'Six-hour play, four-mic calls',
    'Weighing 4.1g each, the earbuds disappear into the ear canal. Four beam-forming microphones isolate your voice from the street. Wireless charging case included.'],
  ['Meridian Bluetooth Speaker', 'electronics', 'northline', 18500, null, 40, 'new', false, 'Woven fabric · aluminium', '360° sound, IPX7 water resistant',
    'A palm-sized speaker with a passive bass radiator that punches well above its size. Pairs in stereo with a second unit and floats if it takes a swim.'],
  ['Halden Wool Overcoat', 'fashion', 'atlas', 34900, null, 18, 'bestseller', true, '80% wool · 20% recycled poly', 'Oversized drape, unlined shoulder',
    'Cut from an Italian wool blend with a relaxed drop shoulder and a full lining in the sleeves so it slides on over knitwear. Two deep welt pockets, one interior.'],
  ['Ribbed Merino Crewneck', 'fashion', 'atlas', 12900, 15900, 46, 'new', true, '100% extra-fine merino', 'Mid-weight, non-itch rib',
    'Extra-fine 19.5-micron merino that wears close without itching. Ribbed at the cuffs and hem to hold shape through seasons, not months.'],
  ['Everyday Poplin Shirt', 'fashion', 'atlas', 8900, null, 62, null, false, 'Organic cotton poplin', 'Relaxed fit, mother-of-pearl buttons',
    'A shirt that hangs properly without ironing drama. Garment-washed organic poplin, boxy through the body with a softly fused collar.'],
  ['Cropped Utility Jacket', 'fashion', 'atlas', 19900, null, 25, 'new', false, 'Cotton twill · recycled lining', 'Boxy cropped cut',
    'Built for shoulder seasons: a cropped cotton twill shell with storm flaps and two bellows pockets. Softens with every wash.'],
  ['Motion Runner Low', 'shoes', 'verve', 15900, 18900, 42, 'bestseller', true, 'Full-grain leather · rubber sole', 'Cushioned daily trainer',
    'A clean low-top on a responsive EVA midsole. Full-grain leather uppers break in within a week; the rubber outsole is siped for wet pavement.'],
  ['Court Classic Sneaker', 'shoes', 'verve', 12900, null, 55, 'new', true, 'Canvas · vulcanised rubber', 'Timeless court profile',
    'Vulcanised canvas uppers on a gum sole, with a reinforced toe cap and a padded collar. The pair you replace with the identical pair.'],
  ['Terra Trail Boot', 'shoes', 'altitude', 24900, null, 16, 'limited', false, 'Waterproof nubuck · Vibram sole', 'All-terrain hiking boot',
    'A waterproof membrane keeps weather out while a Vibram Megagrip outsole bites into loose ground. Mid-cut ankle support without stiffness.'],
  ['Slip-On Loafer', 'shoes', 'verve', 17900, 20900, 22, null, false, 'Suede · leather lining', 'Unlined, flexible sole',
    'An unlined suede loafer on a flexible leather sole. Wears like a slipper, reads like a dress shoe.'],
  ['Sculpted Ceramic Table Lamp', 'home', 'terracotta', 22900, null, 19, 'bestseller', true, 'Hand-thrown stoneware · linen shade', 'Warm dimmable light',
    'Each base is thrown by hand, so no two glazes land the same. Includes a linen drum shade and a dimmable warm-white bulb at 2700K.'],
  ['Stoneware Dinner Set (4)', 'home', 'terracotta', 18900, 21900, 27, 'new', false, 'Reactive-glaze stoneware', '16 pieces, dishwasher safe',
    'Four dinner plates, four side plates, four bowls and four mugs in a reactive glaze that pools differently on every piece. Oven to dishwasher safe.'],
  ['Linen Bedding Set', 'home', 'terracotta', 27900, null, 31, 'bestseller', true, '100% European flax linen', 'Stonewashed, breathable',
    'Stonewashed European flax with a relaxed drape that softens with every wash. Includes duvet cover and two pillowcases with envelope closures.'],
  ['Oak Side Table', 'home', 'terracotta', 32900, null, 12, null, false, 'Solid white oak', 'Rounded edge, flat-pack assembly',
    'Solid white oak with a hand-sanded rounded edge and a matte hardwax oil finish. Assembles in under ten minutes with the included key.'],
  ['Woven Wool Throw', 'home', 'terracotta', 14900, 17900, 38, null, false, 'Recycled wool blend', 'Fringed, generous 130×180cm',
    'A heavyweight recycled-wool throw woven in small runs. Warm without weight, with hand-knotted fringe.'],
  ['Balance Hydrating Serum', 'beauty', 'lumen', 6900, null, 74, 'bestseller', true, 'Hyaluronic acid · niacinamide', 'Plumps, calms, fragrance-free',
    'Three molecular weights of hyaluronic acid hydrate at different depths, while 2% niacinamide calms redness over four weeks. Fragrance-free and non-comedogenic.'],
  ['Gentle Cleansing Gel', 'beauty', 'lumen', 4500, 5500, 96, 'new', false, 'Amino-acid surfactants', 'pH-balanced daily cleanser',
    'An amino-acid cleansing gel that removes sunscreen without stripping the barrier. Rinses clean, leaves no film.'],
  ['Daily Mineral SPF 50', 'beauty', 'lumen', 5900, null, 88, 'bestseller', false, 'Zinc oxide · squalane', 'No white cast',
    'A sheer zinc-oxide formula buffered with squalane so it spreads like a moisturiser. Broad spectrum SPF 50, reef-safe filters.'],
  ['Overnight Repair Cream', 'beauty', 'lumen', 7900, null, 52, 'new', false, 'Ceramides · peptides', 'Barrier support, fragrance-free',
    'A rich but non-greasy night cream built around a ceramide complex and five peptides. Most people see smoother texture within two weeks.'],
  ['Pro Grip Yoga Mat', 'sports', 'altitude', 11900, 13900, 44, 'bestseller', true, 'Natural rubber · recycled top', '6mm cushion, non-slip',
    'A 6mm natural-rubber core absorbs impact at the knees while a recycled top layer grips better as it gets damp. Includes a cotton carry strap.'],
  ['Adjustable Dumbbell Pair', 'sports', 'altitude', 28900, null, 15, 'new', false, 'Cast iron · rubber coating', '2.5–24kg per hand',
    'Dial from 2.5 to 24kg in 2.5kg steps without leaving the bench. Rubber-coated plates protect floors and stay quiet on the drop.'],
  ['Trail Running Pack 18L', 'sports', 'altitude', 16900, null, 23, null, false, 'Ripstop nylon · hydration ready', 'Vest fit, 18 litres',
    'A body-hugging vest pack with a two-bottle front harness, stretch rear pockets and a waterproof roll-top. Sits still on technical descents.'],
  ['Recovery Foam Roller', 'sports', 'altitude', 5900, 7900, 67, null, false, 'EVA foam', 'Dense, textured surface',
    'A firm EVA roller with a three-zone tread that mimics a therapist thumb. Holds shape under daily use.'],
  ['Carry Structured Tote', 'bags', 'carry', 24900, 29900, 26, 'bestseller', true, 'Full-grain vegetable-tanned leather', 'Fits a 16-inch laptop',
    'Cut from vegetable-tanned leather that darkens beautifully with wear. A structured base keeps the bag upright; an interior sleeve holds a 16-inch laptop.'],
  ['Weekender Duffle 45L', 'bags', 'carry', 31900, null, 14, 'new', false, 'Waxed canvas · leather trim', 'Cabin friendly 45L',
    'Waxed canvas panels with leather reinforcement at every stress point. Sized to fit cabin overheads, with a separate shoe compartment.'],
  ['Minimal Card Holder', 'bags', 'carry', 4900, null, 88, null, false, 'Pebbled leather', 'Four slots, one note sleeve',
    'Four card slots and a centre sleeve for folded notes, in a leather that stays slim even when full.'],
  ['Everyday Crossbody', 'bags', 'carry', 13900, 15900, 41, null, false, 'Nappa leather', 'Adjustable webbed strap',
    'A compact crossbody with an adjustable webbing strap, magnetic flap and a soft nappa body that folds flat for packing.'],
  ['Canvas Market Tote', 'bags', 'carry', 5900, null, 72, 'new', false, 'Heavyweight organic canvas', 'Machine washable',
    'A 16oz organic canvas tote with an interior zip pocket and reinforced handles. Washes clean, carries heavy.'],
];

const DESCRIPTIONS = {};

const COLLECTIONS = [
  ['new-arrivals', 'New Arrivals', 'The latest drops across every category.', true, 'seasonal'],
  ['best-sellers', 'Best Sellers', 'The pieces customers return for.', true, 'seasonal'],
  ['the-wardrobe-edit', 'The Wardrobe Edit', 'Outerwear, knitwear and footwear built to layer.', true, 'seasonal'],
  ['home-refresh', 'Home Refresh', 'Lighting, ceramics and textiles for slow living.', true, 'seasonal'],
  ['tech-essentials', 'Tech Essentials', 'Audio, wearables and everyday carry tech.', false, 'seasonal'],
  ['gifts-under-15000', 'Gifts Under Rs 15,000', 'Considered gifts that never feel cheap.', true, 'gift'],
];

const REVIEWS = [
  [5, 'Better than expected', "The build quality is genuinely excellent — it feels like something twice the price. Packaging was minimal and plastic-free, which I appreciated."],
  [4, 'Really good, one small note', 'Exactly as pictured and arrived two days early. I sized up based on the guide and it was the right call. Only wish there were more colour options.'],
  [5, 'Daily driver', "I've used this every single day for six weeks and it still looks new. Would absolutely buy again and probably will."],
  [5, 'Worth it', 'I compared three options before choosing this one and I am glad I did. The details are considered — nothing feels like an afterthought.'],
  [3, 'Good but sizing runs snug', 'The quality is there, but I would recommend sizing up. Customer service replied within a day and sorted the exchange without fuss.'],
  [5, 'Bought a second one', 'Bought one for myself and immediately ordered another as a gift. That says everything.'],
];

async function upsertCategory(slug, name, description, imageKey, isFeatured, position) {
  const r = await sql`
    insert into categories (slug, name, description, image_url, position, is_active)
    values (${slug}, ${name}, ${description}, ${'/images/products/' + imageKey + '.jpg'}, ${position}, true)
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      image_url = excluded.image_url,
      position = excluded.position
    returning id`;
  return r[0].id;
}


/** Distinct photography per product (all files live in public/images/products). */
const PRODUCT_IMAGES = {
  'Aurora Wireless Headphones': 'electronics-headphones-1',
  'Atlas Smartwatch Series 3': 'electronics-smartwatch-1',
  'Quiet Studio Earbuds': 'electronics-earbuds-1',
  'Meridian Bluetooth Speaker': 'electronics-speaker-1',
  'Halden Wool Overcoat': 'fashion-coat-1',
  'Ribbed Merino Crewneck': 'fashion-knit-1',
  'Everyday Poplin Shirt': 'fashion-shirt-1',
  'Cropped Utility Jacket': 'fashion-coat-1',
  'Motion Runner Low': 'shoes-sneakers-1',
  'Court Classic Sneaker': 'shoes-sneakers-1',
  'Terra Trail Boot': 'shoes-boot-1',
  'Slip-On Loafer': 'shoes-loafer-1',
  'Sculpted Ceramic Table Lamp': 'home-lamp-1',
  'Stoneware Dinner Set (4)': 'home-ceramics-1',
  'Linen Bedding Set': 'home-throw-1',
  'Oak Side Table': 'home-table-1',
  'Woven Wool Throw': 'home-throw-1',
  'Balance Hydrating Serum': 'beauty-serum-1',
  'Gentle Cleansing Gel': 'beauty-serum-1',
  'Daily Mineral SPF 50': 'beauty-cream-1',
  'Overnight Repair Cream': 'beauty-cream-1',
  'Pro Grip Yoga Mat': 'sports-yoga-mat-1',
  'Adjustable Dumbbell Pair': 'sports-yoga-mat-1',
  'Trail Running Pack 18L': 'bags-tote-1',
  'Recovery Foam Roller': 'sports-yoga-mat-1',
  'Carry Structured Tote': 'bags-tote-1',
  'Weekender Duffle 45L': 'bags-tote-1',
  'Minimal Card Holder': 'bags-tote-1',
  'Everyday Crossbody': 'bags-tote-1',
  'Canvas Market Tote': 'bags-tote-1',
};

/** Second image shown on card hover, per category. */
const HOVER_IMAGES = {
  electronics: '/images/hero/hero-side.jpg',
  fashion: '/images/hero/hero-main.jpg',
  shoes: '/images/hero/hero-side.jpg',
  home: '/images/hero/hero-main.jpg',
  beauty: '/images/hero/hero-side.jpg',
  sports: '/images/hero/hero-main.jpg',
  bags: '/images/hero/hero-side.jpg',
};

async function main() {
  console.log('→ seeding general catalogue…');

  const catIds = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const [slug, name, desc, imageKey] = CATEGORIES[i];
    catIds[slug] = await upsertCategory(slug, name, desc, imageKey, true, i);
  }

  const brandIds = {};
  for (let i = 0; i < BRANDS.length; i++) {
    const [slug, name, desc, featured] = BRANDS[i];
    const r = await sql`
      insert into brands (slug, name, description, is_featured, position)
      values (${slug}, ${name}, ${desc}, ${featured}, ${i})
      on conflict (slug) do update set name = excluded.name, description = excluded.description, position = excluded.position
      returning id`;
    brandIds[slug] = r[0].id;
  }

  const catImage = Object.fromEntries(CATEGORIES.map(([slug, , , imageKey]) => [slug, imageKey]));
  const manifest = {};

  for (let i = 0; i < PRODUCTS.length; i++) {
    const [name, cat, brand, price, compare, stock, badge, featured, material, subtitle, description] = PRODUCTS[i];
    const slug = slugify(name);
    const primary = `/images/products/${PRODUCT_IMAGES[name] || catImage[cat]}.jpg`;
    manifest[slug] = { name, category: cat };

    const existing = await sql`select id from products where slug = ${slug} limit 1`;
    let id;
    if (existing[0]) {
      id = existing[0].id;
      await sql`
        update products set name=${name}, subtitle=${subtitle}, description=${description},
          category_id=${catIds[cat]}, brand_id=${brandIds[brand]}, price=${price * 100},
          compare_at_price=${compare ? compare * 100 : null}, stock=${stock}, badge=${badge},
          is_featured=${!!featured}, material=${material}, updated_at=now()
        where id=${id}`;
    } else {
      const r = await sql`
        insert into products (slug, name, subtitle, description, story, category_id, brand_id, price,
          compare_at_price, stock, badge, is_featured, material, sku, tags, rating_avg, rating_count,
          sold_count, created_at)
        values (${slug}, ${name}, ${subtitle}, ${description}, ${'Designed in-house and made with suppliers we visit. ' + name + ' is built to be used daily, repaired where possible, and kept for years rather than seasons.'},
          ${catIds[cat]}, ${brandIds[brand]}, ${price * 100}, ${compare ? compare * 100 : null}, ${stock},
          ${badge}, ${!!featured}, ${material}, ${'STK-' + slug.slice(0, 10).toUpperCase()},
          ${[cat, brand, badge || 'classic']}, 0, 0, ${Math.floor(20 + Math.random() * 240)},
          ${new Date(Date.now() - (PRODUCTS.length - i) * 432e5).toISOString()})
        returning id`;
      id = r[0].id;
    }

    const mediaRows = await sql`select url from product_images where product_id = ${id} order by position`;
    const staleMedia = mediaRows.some(({ url }) => url?.startsWith('/images/')
      && !fsSync.existsSync(path.resolve('public', url.replace(/^\/+/, ''))));
    if (mediaRows.length === 0 || staleMedia) {
      await sql`delete from product_images where product_id = ${id}`;
      const gallery = [primary, HOVER_IMAGES[cat] || '/images/hero/hero-main.jpg'];
      const unique = [...new Set(gallery)];
      for (let p = 0; p < unique.length; p++) {
        await sql`insert into product_images (product_id, url, alt, position) values (${id}, ${unique[p]}, ${name}, ${p})`;
      }
    }

    const vCount = await sql`select count(*)::int n from product_variants where product_id = ${id}`;
    if (vCount[0].n === 0) {
      const variantSets = {
        fashion: ['XS', 'S', 'M', 'L', 'XL'],
        shoes: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10'],
        bags: ['One size'],
        electronics: ['Black', 'Sand', 'Forest'],
        home: ['Natural', 'Charcoal'],
        beauty: ['30ml', '50ml', '100ml'],
        sports: ['Standard'],
      };
      const opts = variantSets[cat] || ['Standard'];
      if (opts.length > 1) {
        for (let k = 0; k < opts.length; k++) {
          await sql`insert into product_variants (product_id, name, option_name, price_delta, stock, position)
            values (${id}, ${opts[k]}, ${cat === 'fashion' || cat === 'shoes' ? 'Size' : 'Colour'}, 0, ${Math.max(2, Math.floor(stock / opts.length))}, ${k})`;
        }
      }
    }
  }

  // collections
  for (let i = 0; i < COLLECTIONS.length; i++) {
    const [slug, name, desc, featured, kind] = COLLECTIONS[i];
    const c = await sql`
      insert into collections (slug, name, description, image_url, is_featured, position)
      values (${slug}, ${name}, ${desc}, ${'/images/hero/' + (kind === 'gift' ? 'hero-side' : 'hero-main') + '.jpg'}, ${featured}, ${i})
      on conflict (slug) do update set name=excluded.name, description=excluded.description, image_url=excluded.image_url, position=excluded.position
      returning id`;
    const cid = c[0].id;
    const cnt = await sql`select count(*)::int n from collection_products where collection_id = ${cid}`;
    if (cnt[0].n === 0) {
      let picks = [];
      if (slug === 'new-arrivals') picks = PRODUCTS.filter((p) => p[6] === 'new');
      else if (slug === 'best-sellers') picks = PRODUCTS.filter((p) => p[6] === 'bestseller');
      else if (slug === 'the-wardrobe-edit') picks = PRODUCTS.filter((p) => ['fashion', 'shoes', 'bags'].includes(p[1]));
      else if (slug === 'home-refresh') picks = PRODUCTS.filter((p) => p[1] === 'home');
      else if (slug === 'tech-essentials') picks = PRODUCTS.filter((p) => p[1] === 'electronics');
      else picks = PRODUCTS.filter((p) => p[3] < 15000);
      for (let k = 0; k < picks.length; k++) {
        const p = await sql`select id from products where slug = ${slugify(picks[k][0])} limit 1`;
        if (p[0]) await sql`insert into collection_products (collection_id, product_id, position) values (${cid}, ${p[0].id}, ${k}) on conflict do nothing`;
      }
    }
  }

  // currencies
  const { FALLBACK_RATES, CURRENCY_META } = await import('../src/lib/money.js');
  for (const [code, rate] of Object.entries(FALLBACK_RATES)) {
    const m = CURRENCY_META[code];
    await sql`
      insert into currencies (code, name, symbol, rate_to_base, decimals, is_active, is_default)
      values (${code}, ${m.name}, ${m.symbol}, ${rate}, ${m.decimals}, true, ${code === 'PKR'})
      on conflict (code) do update set name = excluded.name, symbol = excluded.symbol
    `;
  }

  // themes
  const { THEMES } = await import('../src/lib/themes.js');
  for (let i = 0; i < THEMES.length; i++) {
    const t = THEMES[i];
    await sql`
      insert into themes (slug, name, description, swatch, colors, position)
      values (${t.slug}, ${t.name}, ${t.description}, ${t.swatch[1]}, ${sql.json(t.colors)}, ${i})
      on conflict (slug) do update set name=excluded.name, description=excluded.description,
        swatch=excluded.swatch, colors=excluded.colors, position=excluded.position
    `;
  }

  // homepage sections
  await sql`delete from homepage_sections where key in ('hero','marquee','categories','featured','promo','new','story','bestsellers','collection-grid','lifestyle','values','reviews','gallery','newsletter')`;
  const SECTIONS = [
    ['hero', 'hero', 'Everything, considered.', 'A multi-category store for people who care how things are made — electronics, wardrobe, home and everyday carry, chosen by hand.', 'New season', '/images/hero/hero-main.jpg', 'Shop all', '/shop', { secondary_image: '/images/hero/hero-side.jpg', secondary_cta: 'Our story', secondary_href: '/about', stats: [['7', 'Categories'], ['300+', 'Products'], ['48h', 'Dispatch'], ['30-day', 'Returns']] }],
    ['marquee', 'marquee', null, null, null, null, null, null, { items: ['Free delivery over Rs 15,000', '30-day easy returns', 'Cash on delivery', '2-year quality promise'] }],
    ['categories', 'categories', 'Shop by category', 'Seven departments, one standard of making.', 'Departments', null, null, null, { limit: 7 }],
    ['featured', 'products', 'Featured this week', 'A handpicked edit across the store, refreshed every week.', 'The edit', null, 'View all', '/shop', { source: 'featured', limit: 8 }],
    ['promo', 'banner', 'The Wardrobe Edit', 'Outerwear, knitwear and footwear built to layer. New season arrivals across every category.', 'Seasonal', '/images/products/fashion-coat-1.jpg', 'Shop the edit', '/collections/the-wardrobe-edit', { align: 'left' }],
    ['new', 'products', 'New arrivals', 'Fresh in across tech, fashion, home and beauty.', 'Just landed', null, 'View all', '/collections/new-arrivals', { source: 'new', limit: 4 }],
    ['story', 'story', 'Chosen, not stocked', 'We are a small buying team, not a marketplace. Every product is sampled in person, used for weeks, and only listed if it survives real life. That is why the catalogue grows slowly and why we happily tell you which items we would buy ourselves.', 'Our story', '/images/hero/hero-main.jpg', 'Read more', '/about', { portrait: '/images/hero/hero-side.jpg' }],
    ['bestsellers', 'products', 'Best sellers', 'The products customers come back for, across every department.', 'Most loved', null, 'View all', '/collections/best-sellers', { source: 'bestsellers', limit: 4 }],
    ['collection-grid', 'collections', 'Collections', 'Seasonal edits and curated sets for every part of life.', 'Curated', null, null, null, {}],
    ['brands', 'brands', 'Brands we carry', 'Independent makers and in-house labels worth knowing.', 'The makers', null, null, null, {}],
    ['reviews', 'reviews', 'What customers say', 'Verified reviews from real purchases, across the catalogue.', 'Reviews', null, null, null, {}],
    ['values', 'values', 'The standard', null, null, null, null, null, { items: [['48h', 'Dispatch window'], ['30-day', 'Free returns'], ['2-year', 'Quality promise'], ['Carbon', 'Offset delivery']] }],
    ['gallery', 'instagram', 'From the community', 'Tag @thestore to be featured', 'Social', null, null, null, {}],
    ['newsletter', 'newsletter', 'Get first access', 'New arrivals, restocks and editor picks. One email a week, no noise.', 'The list', null, null, null, {}],
  ];
  for (let i = 0; i < SECTIONS.length; i++) {
    const [key, type, title, subtitle, eyebrow, image, cta, href, config] = SECTIONS[i];
    await sql`
      insert into homepage_sections (key, type, title, subtitle, eyebrow, image_url, cta_label, cta_href, config, position)
      values (${key}, ${type}, ${title}, ${subtitle}, ${eyebrow}, ${image}, ${cta}, ${href}, ${sql.json(config)}, ${i})
      on conflict (key) do update set type=excluded.type, title=excluded.title, subtitle=excluded.subtitle,
        eyebrow=excluded.eyebrow, image_url=excluded.image_url, cta_label=excluded.cta_label,
        cta_href=excluded.cta_href, config=excluded.config, position=excluded.position
    `;
  }

  // coupons
  for (const [code, type, value, min] of [['WELCOME10', 'percent', 10, 0], ['SAVE15', 'percent', 15, 2000000], ['FLAT1000', 'fixed', 100000, 1000000], ['FREESHIP', 'freeship', 0, 0]]) {
    await sql`insert into coupons (code, type, value, min_subtotal) values (${code}, ${type}, ${value}, ${min}) on conflict (code) do nothing`;
  }

  // settings defaults
  const { SETTING_DEFAULTS } = await import('../src/lib/settings.js');
  for (const [k, fn] of Object.entries(SETTING_DEFAULTS)) {
    const exists = await sql`select 1 from settings where key = ${k} limit 1`;
    if (!exists[0]) await sql`insert into settings (key, value) values (${k}, ${sql.json(fn())})`;
  }
  // refresh store copy for the new direction
  await sql`update settings set value = value || ${sql.json({
    name: 'NOVA', tagline: 'Everything, considered.',
    announcement: 'Free delivery over Rs 15,000 — 30-day easy returns',
    email: 'hello@novastore.com', address: 'Studio 4, Gulberg III, Lahore, Pakistan', logo_text: 'NOVA',
    phone: '+92 42 3571 0000',
  })} where key = 'store'`;
  await sql`update settings set value = value || ${sql.json({
    free_threshold: 1500000, flat_rate: 25000, express_rate: 60000, tax_percent: 0,
    delivery_days: '2–4 business days', return_window_days: 30,
  })} where key = 'shipping'`;
  await sql`update settings set value = value || ${sql.json({
    from_name: 'NOVA',
    bank_details: 'Bank: Meezan Bank\nTitle: NOVA Commerce (Pvt) Ltd\nAccount: 0123 4567 8901 2345\nIBAN: PK00 MEZN 0000 0000 0000 0000',
  })} where key = 'payments'`;

  // admin
  const { hashPassword } = await import('../src/lib/db.js');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@novastore.com').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'NovaStudio2026!';
  const hasAdmin = await sql`select 1 from admins limit 1`;
  if (!hasAdmin[0]) {
    await sql`insert into admins (name, email, password_hash, role, permissions)
      values ('Store Owner', ${adminEmail}, ${hashPassword(adminPass)}, 'owner', ${sql.json(['*'])})`;
    console.log(`✔ admin created: ${adminEmail}`);
  }

  // demo customer + reviews
  const demoEmail = 'client@novastore.com';
  let cust = await sql`select id from customers where email = ${demoEmail} limit 1`;
  if (!cust[0]) {
    const r = await sql`insert into customers (name, email, password_hash, email_verified, email_verified_at)
      values ('Ayesha Malik', ${demoEmail}, ${hashPassword('ClientDemo2026!')}, true, now()) returning id`;
    cust = r;
  }
  const revCount = await sql`select count(*)::int n from reviews`;
  if (revCount[0].n === 0) {
    const prods = await sql`select id from products where is_active order by sold_count desc limit ${REVIEWS.length}`;
    for (let i = 0; i < prods.length && i < REVIEWS.length; i++) {
      const [rating, title, body] = REVIEWS[i];
      // is_verified stays false: nobody has actually bought these in the seeded data.
      await sql`insert into reviews (product_id, customer_id, rating, title, body, is_verified, is_approved, is_featured)
        values (${prods[i].id}, ${cust[0].id}, ${rating}, ${title}, ${body}, false, true, ${i < 3})
        on conflict do nothing`;
      await sql`update products set rating_avg = ${rating}, rating_count = 1 where id = ${prods[i].id}`;
    }
  }

  await fs.writeFile(path.resolve('scripts/image-manifest.json'), JSON.stringify(manifest, null, 2));
  const counts = await sql`select (select count(*) from products) p, (select count(*) from categories) c,
    (select count(*) from brands) b, (select count(*) from collections) co, (select count(*) from homepage_sections) s`;
  console.log('✔ seeded', counts[0]);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
