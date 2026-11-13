import { sql } from '@/lib/db';
import { fail, json, ok, parse, schemas } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return json({ addresses: [] });
  const addresses = await sql`
    select * from addresses where customer_id = ${customer.id}
    order by is_default_shipping desc, created_at desc
  `;
  return json({ addresses });
}

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  const { data, error } = await parse(request, schemas.address);
  if (error) return fail(error, 422);
  const count = await sql`select count(*)::int n from addresses where customer_id = ${customer.id}`;
  const isDefault = data.isDefault || count[0].n === 0;
  if (isDefault) await sql`update addresses set is_default_shipping = false where customer_id = ${customer.id}`;
  const rows = await sql`
    insert into addresses (customer_id, label, full_name, phone, line1, line2, city, state, postal_code, country, is_default_shipping)
    values (${customer.id}, ${data.label || null}, ${data.fullName}, ${data.phone}, ${data.line1}, ${data.line2 || null},
      ${data.city}, ${data.state || null}, ${data.postalCode || null}, ${data.country}, ${isDefault})
    returning *
  `;
  return json({ ok: true, address: rows[0] });
}

export async function DELETE(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  const id = new URL(request.url).searchParams.get('id');
  await sql`delete from addresses where id = ${id} and customer_id = ${customer.id}`;
  return ok({ deleted: true });
}

export async function PATCH(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body?.id) return fail('Missing address', 400);
  await sql`update addresses set is_default_shipping = false where customer_id = ${customer.id}`;
  await sql`update addresses set is_default_shipping = true where id = ${body.id} and customer_id = ${customer.id}`;
  return ok({ saved: true });
}
