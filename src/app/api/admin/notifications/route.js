import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await guard('orders:read');
  if (error) return fail(error, status);
  const rows = await sql`select id,type,title,body,details,is_read,created_at from admin_notifications order by is_read asc,created_at desc limit 30`;
  return json({ notifications: rows, unread: rows.filter((r) => !r.is_read).length });
}

export async function PATCH(request) {
  const { error, status } = await guard('orders:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid request.', 400); }
  if (body.all === true) await sql`update admin_notifications set is_read=true where is_read=false`;
  else if (typeof body.id === 'string') await sql`update admin_notifications set is_read=true where id=${body.id}`;
  else return fail('Notification ID is required.', 422);
  return json({ ok: true });
}
