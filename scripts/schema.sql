-- ============================================================
-- NOVA — production schema (idempotent, non-destructive)
-- Money is stored in minor units of the base store currency.
-- ============================================================
-- pgcrypto optional (gen_random_uuid is built-in on PG13+)
do $$ begin
  create extension if not exists pgcrypto;
exception when others then null;
end $$;

-- ---------- admin ----------
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',           -- owner | admin | manager | support
  permissions jsonb not null default '[]'::jsonb,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- customers ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  phone text,
  avatar_url text,
  email_verified boolean not null default false,
  email_verified_at timestamptz,
  theme_palette text,                            -- null = inherit admin default
  theme_mode text,
  font_preference jsonb not null default '{}'::jsonb,
  currency text,
  marketing_opt_in boolean not null default false,
  is_blocked boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table customers add column if not exists font_preference jsonb not null default '{}'::jsonb;

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose text not null,                          -- verify_email | reset_password
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  subject_type text not null,                     -- customer | admin
  subject_id uuid not null,
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null default 'Pakistan',
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now()
);


-- ---------- brands ----------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  logo_url text,
  website text,
  is_featured boolean not null default false,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- catalog ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  parent_id uuid references categories(id) on delete set null,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  description text,
  story text,
  category_id uuid references categories(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  price int not null default 0,                   -- minor units, base currency
  compare_at_price int,
  cost_price int,
  sku text,
  stock int not null default 0,
  low_stock_threshold int not null default 5,
  material text,
  badge text,                                     -- new | bestseller | limited | featured
  is_featured boolean not null default false,
  is_active boolean not null default true,
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  sold_count int not null default 0,
  tags text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  option_name text,
  price_delta int not null default 0,
  sku text,
  stock int not null default 0,
  position int not null default 0
);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  alt text,
  position int not null default 0
);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_url text,
  is_featured boolean not null default false,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists collection_products (
  collection_id uuid not null references collections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  position int not null default 0,
  primary key (collection_id, product_id)
);

-- ---------- cart ----------
create table if not exists carts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  customer_id uuid references customers(id) on delete set null,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  qty int not null default 1 check (qty > 0),
  unit_price int not null,
  gift_note text,
  created_at timestamptz not null default now()
);

-- ---------- orders ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  email text not null,
  phone text,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_method text not null default 'cod',
  currency text not null default 'PKR',           -- transaction currency
  fx_rate numeric(18,6) not null default 1,       -- base units per 1 unit of `currency`
  subtotal int not null default 0,
  discount_total int not null default 0,
  shipping_total int not null default 0,
  tax_total int not null default 0,
  grand_total int not null default 0,             -- base currency minor units
  display_total int not null default 0,           -- charged currency minor units
  coupon_code text,
  shipping_address jsonb not null default '{}'::jsonb,
  billing_address jsonb not null default '{}'::jsonb,
  notes text,
  tracking_number text,
  carrier text,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variant_id uuid references product_variants(id) on delete set null,
  name text not null,
  variant_name text,
  sku text,
  image_url text,
  qty int not null,
  unit_price int not null,
  line_total int not null
);

create table if not exists order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  note text,
  actor text not null default 'system',
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Customer response workflow for out-for-delivery orders. Reminder leasing is database-backed,
-- so only one browser tab can claim a reminder at a time.
create table if not exists delivery_confirmations (
  order_id uuid primary key references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  state text not null default 'pending',
  response_at timestamptz,
  next_reminder_at timestamptz not null default now(),
  last_reminder_at timestamptz,
  reminder_count int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text not null,
  details jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_notifications_unread on admin_notifications(is_read, created_at desc);

-- ---------- reviews ----------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text not null,
  images text[] not null default '{}',
  is_verified boolean not null default false,
  is_approved boolean not null default true,
  is_featured boolean not null default false,
  helpful_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, customer_id)
);

create table if not exists review_helpful (
  review_id uuid not null references reviews(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, customer_id)
);

create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- ---------- commerce config ----------
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null default 'percent',           -- percent | fixed | freeship
  value int not null default 0,
  min_subtotal int not null default 0,
  max_discount int,
  usage_limit int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists currencies (
  code text primary key,
  name text not null,
  symbol text not null,
  rate_to_base numeric(18,6) not null default 1,  -- units of base currency per 1 unit
  decimals int not null default 2,
  is_active boolean not null default true,
  is_default boolean not null default false,
  manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  swatch text,
  colors jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists homepage_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type text not null,                             -- hero | marquee | categories | products | banner | story | reviews | instagram | newsletter | values
  title text,
  subtitle text,
  eyebrow text,
  image_url text,
  cta_label text,
  cta_href text,
  config jsonb not null default '{}'::jsonb,
  position int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text,
  template text,
  order_id uuid,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists page_views (
  id bigserial primary key,
  path text not null,
  visitor_id text,
  visitor_hash text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  delta int not null,
  reason text,
  actor text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_type text not null,
  actor_id uuid,
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists newsletter_subscribers (
  email text primary key,
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_active on products(is_active) where is_active;
create index if not exists idx_products_featured on products(is_featured) where is_featured;
create index if not exists idx_products_created on products(created_at desc);
create index if not exists idx_products_sold on products(sold_count desc);
create index if not exists idx_products_tags on products using gin(tags);
create index if not exists idx_product_images_product on product_images(product_id, position);
create index if not exists idx_variants_product on product_variants(product_id, position);
create index if not exists idx_cart_items_cart on cart_items(cart_id);
create index if not exists idx_carts_customer on carts(customer_id);
create index if not exists idx_orders_customer on orders(customer_id, placed_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_placed on orders(placed_at desc);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_order_events_order on order_events(order_id, created_at);
create index if not exists idx_reviews_product on reviews(product_id, created_at desc);
create index if not exists idx_reviews_customer on reviews(customer_id);
create index if not exists idx_sessions_token on sessions(token_hash);
create index if not exists idx_otp_email on otp_codes(email, purpose);
create index if not exists idx_addresses_customer on addresses(customer_id);
create index if not exists idx_page_views_created on page_views(created_at desc);
create index if not exists idx_page_views_path on page_views(path);
create index if not exists idx_email_logs_created on email_logs(created_at desc);
create index if not exists idx_audit_created on audit_logs(created_at desc);
create index if not exists idx_wishlists_customer on wishlists(customer_id);
create index if not exists idx_collection_products_col on collection_products(collection_id, position);

-- ---------- additive migrations (safe to re-run) ----------
alter table products add column if not exists brand_id uuid references brands(id) on delete set null;
create index if not exists idx_products_brand on products(brand_id);
alter table homepage_sections add column if not exists layout text;
alter table homepage_sections add column if not exists visible_on text[] not null default '{home}';
alter table products add column if not exists brand_name text;
alter table orders add column if not exists admin_note text;

-- additive migrations (safe to re-run) ----------
alter table newsletter_subscribers add column if not exists unsubscribed_at timestamptz;
alter table page_views add column if not exists visitor_hash text;
create index if not exists idx_page_views_created on page_views(created_at);
create index if not exists idx_page_views_visitor on page_views(visitor_hash);
