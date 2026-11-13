import { sql } from './db.js';
import { getCurrentAdmin, can } from './auth.js';

export async function guard(permission) {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthenticated', status: 401, admin: null };
  if (permission && !can(admin, permission)) return { error: 'Not permitted', status: 403, admin };
  return { admin, error: null };
}

export async function audit(admin, action, entity, entityId, meta = {}) {
  await sql`
    insert into audit_logs (actor_type, actor_id, actor_email, action, entity, entity_id, meta)
    values ('admin', ${admin?.id || null}, ${admin?.email || null}, ${action}, ${entity}, ${entityId ? String(entityId) : null}, ${sql.json(meta)})
  `.catch(() => {});
}

export async function logEmail(to, subject, template, status, error) {
  await sql`insert into email_logs (to_email, subject, template, status, error) values (${to}, ${subject}, ${template}, ${status}, ${error})`.catch(() => {});
}

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || `item-${Date.now()}`;
}
