# NOVA — a complete commerce platform

A production-ready, multi-category e-commerce platform: animated storefront, full customer
accounts, order lifecycle with transactional email, and a real analytics dashboard — all in one
Next.js 15 codebase backed by PostgreSQL (Neon in production).

**Brand line:** _Everything, considered._

---

## What's inside

### Storefront
- 14 database-driven homepage sections (hero, category grid, curated product rails, promos,
  brand story, reviews, editorial, newsletter, social gallery) — every section is editable,
  re-orderable and publishable from the admin, no code changes needed.
- Product cards with a second image on hover, badges, discount pricing, rating, wishlist and
  quick add; full product pages with gallery + zoom, variant selection, live stock, review
  distribution, related products and recently viewed.
- Search with live suggestions, faceted shop filters (category, brand, price, stock), sorting,
  and pagination.
- Persistent guest cart, discount codes, server-computed totals, checkout with COD / bank
  transfer / Easypaisa / JazzCash, and an order-confirmation page.
- Accounts: register, login, email OTP verification, forgot/reset password, profile & avatar,
  address book, order history with a delivery timeline, wishlist, and preferences.
- Six hand-tuned theme palettes, applied globally; a signed-in customer can pick a personal
  override that never changes the store default.
- Multi-currency (PKR base, USD/GBP/EUR/CNY/AED/SAR plus admin-added codes) with live exchange
  rates and a recorded fx rate on every order.

### Admin (`/admin`)
Dashboard with real SQL analytics (revenue, orders, AOV, customers, conversion, returning rate,
visitors, status counts, low stock, plus a 7/30/90/365-day range switch and animated charts), and
CRUD for products (images, variants, pricing, SEO), categories, collections, brands, inventory
with an adjustment log, orders (status transitions that email the customer exactly once), customers,
review moderation, discount codes, homepage content, themes, currencies, store settings, and
team members with role-based permissions. Every write is recorded in an audit log.

### Delivery lifecycle
`pending → confirmed → processing → packed → shipped → out_for_delivery → delivered`, with
`cancelled` and `returned` as terminal states. Each transition is timestamped, attributed to an
admin, and optionally emailed; duplicate status changes never send a second email.

### Email
Branded templates for welcome, OTP verification, password reset/changed, order placed, each
shipment status, cancellation and refund. Every send is logged to `email_logs` with its result.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, server components) |
| Styling | Hand-written CSS design system with CSS custom properties for theming |
| Database | PostgreSQL — [Neon](https://neon.tech) in production, PGlite locally |
| Queries | [`postgres`](https://github.com/porsager/postgres) tagged templates (parameterised) |
| Images | `next/image` with remote/storage support; S3-compatible object storage for uploads |
| Email | Nodemailer over SMTP |
| Icons | `lucide-react` plus a few hand-rolled brand marks |

No UI kit, no ORM, no state library — the whole surface is intentionally small and readable.

---

## Local development

```bash
npm install
cp .env.example .env.local        # then fill in the values

# Local Postgres (PGlite over a socket — no Docker required)
node scripts/_pgl.mjs             # terminal 1: serves Postgres on :55432
npm run db:migrate                # schema is idempotent and additive
npm run db:seed                   # brand, 30 products, 7 categories, 14 sections

npm run dev                       # http://localhost:3000
```

Sign in at `/admin` with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env.local`.
If SMTP is not configured the app still works — emails are logged with status `skipped` and
OTP codes are returned in the API response during development only.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel; the framework preset is detected automatically.
3. Add the environment variables from `.env.example` (production scope). At minimum:
   `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
   Add the SMTP and S3 values to enable email and image uploads.
4. Deploy. The build runs `scripts/deploy-db.mjs`, which applies the schema and seeds the
   catalogue idempotently — safe to run on every deploy, and it never drops data.

Set `DEPLOY_DB=0` to skip that step for a build that shouldn't touch the database.

---

## Project layout

```
scripts/
  schema.sql          full schema + additive migration block (re-runnable)
  seed.mjs            catalogue, sections, coupons, admin account
  deploy-db.mjs       migrate + seed, runs before `next build` on Vercel
src/
  app/
    (store)/          storefront routes, header/footer shell, loading & error states
    admin/            authenticated admin shell and every management screen
    api/              storefront + admin JSON endpoints
  components/         storefront and admin UI
  lib/                db, auth, cart, catalog, currency, email, orders, settings, themes
public/images/        photography, fonts
```

## Security notes

- Passwords are hashed with scrypt (`node:crypto`), sessions are random 256-bit tokens stored
  hashed, and both cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
- All queries are parameterised. Mutating endpoints validate bodies with Zod.
- Rate limits cover login, registration, OTP issuance, uploads, newsletter and contact.
- Admin routes are gated by permission scopes (`resource:read` / `resource:write`); role defaults
  are defined in `src/lib/auth.js`. Secrets are read from the environment and never sent to the
  browser.
- Verified-purchase review badges are derived from actual delivered/paid order history, never set
  by hand.
