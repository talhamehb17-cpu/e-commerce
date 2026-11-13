import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
const schema = z.object({
  code: z.string().trim().min(2).max(30),
  type: z.enum(['percent', 'fixed', 'freeship']),
  value: z.number().min(0).max(100000000).default(0),
  minSubtotal: z.number().min(0).max(100000000).default(0),
  maxDiscount: z.number().min(0).max(100000000).nullable().optional(),
  usageLimit: z.number().int().min(0).max(1000000).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const { error, status } = await guard('settings:read');
  if (error) return fail(error, status);
  const rows = await sql`select * from coupons order by created_at desc`;
  return json({ coupons: rows });
}

export async function POST(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  const code = d.code.toUpperCase().replace(/\s+/g, '');
  const exists = await sql`select id from coupons where upper(code) = ${code}`;
  if (exists[0]) return fail('That code already exists.', 409);
  const rows = await sql`
    insert into coupons (code, type, value, min_subtotal, max_discount, usage_limit, starts_at, ends_at, is_active)
    values (${code}, ${d.type}, ${Math.round(d.type === 'percent' ? d.value : d.value * 100)},
      ${Math.round(d.minSubtotal * 100)}, ${d.maxDiscount ? Math.round(d.maxDiscount * 100) : null},
      ${d.usageLimit || null}, ${d.startsAt || null}, ${d.endsAt || null}, ${d.isActive})
    returning *`;
  await audit(admin, 'coupon_created', 'coupon', rows[0].id, { code });
  return json({ ok: true, coupon: rows[0] });
}
