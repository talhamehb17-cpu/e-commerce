import { sql } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { z } from 'zod';
import { invalidate } from '@/lib/db';

const schema = z.object({
  currency: z.string().trim().length(3).optional(),
  theme_palette: z.string().trim().max(40).nullable().optional(),
});

export async function POST(request) {
  const customer = await getCurrentCustomer();
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!customer) return ok({ guest: true });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Invalid preferences', 422);

  if (parsed.data.currency) {
    const rows = await sql`select code from currencies where code = ${parsed.data.currency} and is_active`;
    if (!rows[0]) return fail('Unsupported currency', 400);
    await sql`update customers set currency = ${parsed.data.currency}, updated_at = now() where id = ${customer.id}`;
  }
  if (parsed.data.theme_palette !== undefined) {
    await sql`update customers set theme_palette = ${parsed.data.theme_palette || null}, updated_at = now() where id = ${customer.id}`;
  }
  invalidate('theme');
  return ok({ saved: true });
}
