import { sql } from '@/lib/db';
import { fail, json, parse, schemas } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { getProductReviews } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  if (!productId) return fail('Missing productId', 400);
  const data = await getProductReviews(productId, 50, searchParams.get('sort') || 'recent', Number(searchParams.get('rating') || 0));
  return json(data);
}

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to write a review.', 401);
  const { data, error } = await parse(request, schemas.review);
  if (error) return fail(error, 422);

  // Verified purchase is calculated from order history — never fabricated.
  const purchased = await sql`
    select 1 from orders o join order_items oi on oi.order_id = o.id
    where o.customer_id = ${customer.id} and oi.product_id = ${data.productId} and o.status not in ('cancelled')
    limit 1
  `;

  const existing = await sql`select id from reviews where product_id = ${data.productId} and customer_id = ${customer.id} limit 1`;
  let reviewId;
  if (existing[0]) {
    const rows = await sql`
      update reviews set rating = ${data.rating}, title = ${data.title || null}, body = ${data.body},
        images = ${data.images || []}, is_verified = ${!!purchased[0]}, updated_at = now()
      where id = ${existing[0].id} returning id
    `;
    reviewId = rows[0].id;
  } else {
    const rows = await sql`
      insert into reviews (product_id, customer_id, rating, title, body, images, is_verified)
      values (${data.productId}, ${customer.id}, ${data.rating}, ${data.title || null}, ${data.body}, ${data.images || []}, ${!!purchased[0]})
      returning id
    `;
    reviewId = rows[0].id;
  }

  const agg = await sql`select coalesce(avg(rating),0)::numeric(3,2) a, count(*)::int n from reviews where product_id = ${data.productId} and is_approved`;
  await sql`update products set rating_avg = ${agg[0].a}, rating_count = ${agg[0].n} where id = ${data.productId}`;
  return json({ ok: true, id: reviewId, updated: Boolean(existing[0]), verified: Boolean(purchased[0]) });
}

export async function DELETE(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in first.', 401);
  const id = new URL(request.url).searchParams.get('id');
  const rows = await sql`delete from reviews where id = ${id} and customer_id = ${customer.id} returning product_id`;
  if (rows[0]) {
    const agg = await sql`select coalesce(avg(rating),0)::numeric(3,2) a, count(*)::int n from reviews where product_id = ${rows[0].product_id} and is_approved`;
    await sql`update products set rating_avg = ${agg[0].a}, rating_count = ${agg[0].n} where id = ${rows[0].product_id}`;
  }
  return json({ ok: true });
}
