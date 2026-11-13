import { sql, invalidate } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { guard, audit } from '@/lib/admin';

export async function POST(request) {
  const { admin, error, status } = await guard('products:write');
  if (error) return fail(error, status);
  let body; try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return fail('Select at least one product', 422);
  const action = body.action;
  await sql.begin(async (tx) => {
    if (action === 'activate') await tx`update products set is_active = true where id = any(${ids}::uuid[])`;
    else if (action === 'deactivate') await tx`update products set is_active = false where id = any(${ids}::uuid[])`;
    else if (action === 'feature') await tx`update products set is_featured = true where id = any(${ids}::uuid[])`;
    else if (action === 'unfeature') await tx`update products set is_featured = false where id = any(${ids}::uuid[])`;
    else if (action === 'delete') await tx`delete from products where id = any(${ids}::uuid[])`;
    else if (action === 'stock') {
      const n = Math.max(0, Number(body.stock) || 0);
      await tx`update products set stock = ${n} where id = any(${ids}::uuid[])`;
    }
  });
  invalidate('');
  await audit(admin, 'products_bulk', 'product', null, { action, count: ids.length });
  return json({ ok: true, affected: ids.length });
}
