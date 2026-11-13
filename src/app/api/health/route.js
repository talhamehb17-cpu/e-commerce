import { sql } from '@/lib/db';
import { json } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Lightweight production health check: database reachability, catalogue counts and
 * the health of the review aggregates the storefront depends on. No secrets are returned.
 */
export async function GET() {
  const started = Date.now();
  const out = {
    ok: true,
    service: 'nova-commerce',
    time: new Date().toISOString(),
    checks: {},
  };

  async function check(name, fn) {
    const t0 = Date.now();
    try {
      const value = await fn();
      out.checks[name] = { ok: true, ms: Date.now() - t0, value };
    } catch (e) {
      out.ok = false;
      out.checks[name] = { ok: false, ms: Date.now() - t0, error: String(e.message).slice(0, 200) };
    }
  }

  await check('database', async () => {
    const r = await sql`select current_database() as db, version() as version`;
    return { db: r[0].db, version: String(r[0].version).split(',')[0] };
  });

  await check('catalogue', async () => {
    const r = await sql`
      select (select count(*) from products where is_active)::int as products,
             (select count(*) from categories where is_active)::int as categories,
             (select count(*) from brands)::int as brands,
             (select count(*) from collections)::int as collections,
             (select count(*) from homepage_sections where is_active)::int as sections`;
    return r[0];
  });

  await check('reviews', async () => {
    const r = await sql`
      select count(*)::int as total,
             count(*) filter (where is_approved)::int as approved,
             round(avg(rating), 2)::text as avg_rating`;
    const agg = await sql`select round(avg(rating) filter (where rating is not null), 2)::text as avg_rating, count(*)::text as total
      from reviews where coalesce(is_approved, true) = true`;
    return { ...r[0], dashboard_aggregate: agg[0] };
  });

  await check('media', async () => {
    const r = await sql`select count(*)::int as rows from product_images`;
    const broken = await sql`select count(*)::int as n from product_images where url is null or url = ''`;
    return { rows: r[0].rows, empty: broken[0].n };
  });

  out.totalMs = Date.now() - started;
  return json(out, { status: out.ok ? 200 : 503 });
}
