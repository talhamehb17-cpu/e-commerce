import { sql, hashPassword, verifyPassword, sha256 } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '@/lib/auth';

export async function GET() {
  const { admin, error, status } = await guard();
  if (error) return fail(error, status);
  return json({ admin });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard();
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (body.newPassword) {
    if (String(body.newPassword).length < 12) return fail('New password must be at least 12 characters.', 422);
    const rows = await sql`select password_hash from admins where id = ${admin.id}`;
    if (!verifyPassword(body.currentPassword || '', rows[0].password_hash)) return fail('Current password is incorrect.', 403);
    await sql`update admins set password_hash = ${hashPassword(body.newPassword)}, updated_at = now() where id = ${admin.id}`;
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (token) await sql`update sessions set revoked_at = now() where subject_type = 'admin' and subject_id = ${admin.id} and revoked_at is null and token_hash <> ${sha256(token)}`;
    await audit(admin, 'admin_password_changed', 'admin', admin.id);
    return json({ ok: true, passwordChanged: true });
  }
  const patch = {};
  if (body.name) patch.name = String(body.name).slice(0, 80);
  if (body.avatar !== undefined) patch.avatar_url = body.avatar || null;
  if (Object.keys(patch).length) await sql`update admins set ${sql(patch)}, updated_at = now() where id = ${admin.id}`;
  return json({ ok: true });
}
