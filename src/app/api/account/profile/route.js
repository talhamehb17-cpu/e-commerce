import { sql } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  avatar: z.string().trim().max(700).nullable().optional(),
});

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Check the highlighted fields.', 422);

  const patch = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone || null;
  if (parsed.data.avatar !== undefined) patch.avatar_url = parsed.data.avatar || null;

  await sql`
    update customers set ${sql(patch)}, updated_at = now() where id = ${customer.id}
  `;
  return ok({ saved: true });
}
