import { sql, hashPassword, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PERMISSION_GROUPS = [
  { key: 'products', label: 'Catalogue' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'content', label: 'Content' },
  { key: 'settings', label: 'Settings' },
];

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(120),
  role: z.enum(['owner', 'manager', 'staff', 'viewer']).default('staff'),
  permissions: z.array(z.string().max(40)).max(30).default([]),
});

export async function GET() {
  const { admin, error, status } = await guard('settings:read');
  if (error) return fail(error, status);
  const rows = await sql`select id, name, email, role, permissions, avatar_url, last_login_at, created_at from admins order by created_at`;
  return json({ team: rows, currentId: admin.id, permissionGroups: PERMISSION_GROUPS });
}

export async function POST(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  if (admin.role !== 'owner') return fail('Only the store owner can invite team members.', 403);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 422);
  const d = parsed.data;
  const exists = await sql`select id from admins where lower(email) = ${d.email}`;
  if (exists[0]) return fail('An admin with that email already exists.', 409);
  const rows = await sql`
    insert into admins (name, email, password_hash, role, permissions)
    values (${d.name}, ${d.email}, ${hashPassword(d.password)}, ${d.role}, ${sql.json(d.permissions)})
    returning id, name, email, role, permissions`;
  await audit(admin, 'admin_invited', 'admin', rows[0].id, { email: d.email, role: d.role });
  return json({ ok: true, member: rows[0] });
}

export async function PATCH(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  if (admin.role !== 'owner') return fail('Only the store owner can change roles.', 403);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body.id) return fail('Missing admin id', 422);
  if (body.id === admin.id && body.role && body.role !== 'owner') return fail('You cannot demote your own owner account.', 422);

  const patch = {};
  if (body.role) patch.role = body.role;
  if (Array.isArray(body.permissions)) patch.permissions = body.permissions;
  if (body.name) patch.name = String(body.name).slice(0, 80);
  if (!Object.keys(patch).length) return fail('Nothing to update', 400);
  await sql`update admins set ${sql(patch)}, updated_at = now() where id = ${body.id}`;
  await audit(admin, 'admin_updated', 'admin', body.id, patch);
  return json({ ok: true });
}

export async function DELETE(request) {
  const { admin, error, status } = await guard('settings:write');
  if (error) return fail(error, status);
  if (admin.role !== 'owner') return fail('Only the store owner can remove admins.', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('Missing admin id', 422);
  if (id === admin.id) return fail('You cannot remove your own account.', 422);
  const owners = await sql`select count(*)::int n from admins where role = 'owner'`;
  const target = await sql`select role from admins where id = ${id}`;
  if (target[0]?.role === 'owner' && owners[0].n <= 1) return fail('Keep at least one owner account.', 422);
  await sql`delete from admins where id = ${id}`;
  await sql`update sessions set revoked_at = now() where subject_type = 'admin' and subject_id = ${id} and revoked_at is null`;
  await audit(admin, 'admin_removed', 'admin', id);
  return json({ ok: true });
}
