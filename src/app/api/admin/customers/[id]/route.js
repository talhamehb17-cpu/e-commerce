import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function PATCH(request, { params }) {
  const { admin, error, status } = await guard('customers:write');
  if (error) return fail(error, status);
  const { id } = await params;
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body.isBlocked !== undefined) {
    await sql`update customers set is_blocked = ${Boolean(body.isBlocked)}, updated_at = now() where id = ${id}`;
    if (body.isBlocked) await sql`update sessions set revoked_at = now() where subject_id = ${id} and subject_type = 'customer' and revoked_at is null`;
  }
  if (body.emailVerified !== undefined) {
    await sql`update customers set email_verified = ${Boolean(body.emailVerified)} where id = ${id}`;
  }
  await audit(admin, 'customer_updated', 'customer', id, body);
  return json({ ok: true });
}
