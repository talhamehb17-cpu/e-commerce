import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { hashPassword, verifyPassword } from '@/lib/db';

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
    if (String(body.newPassword).length < 8) return fail('New password must be at least 8 characters.', 422);
    const rows = await sql`select password_hash from admins where id = ${admin.id}`;
    if (!verifyPassword(body.currentPassword || '', rows[0].password_hash)) return fail('Current password is incorrect.', 403);
    await sql`update admins set password_hash = ${hashPassword(body.newPassword)}, updated_at = now() where id = ${admin.id}`;
    await audit(admin, 'admin_password_changed', 'admin', admin.id);
    return json({ ok: true, passwordChanged: true });
  }
  const patch = {};
  if (body.name) patch.name = String(body.name).slice(0, 80);
  if (body.avatar !== undefined) patch.avatar_url = body.avatar || null;
  if (Object.keys(patch).length) await sql`update admins set ${sql(patch)}, updated_at = now() where id = ${admin.id}`;
  return json({ ok: true });
}
