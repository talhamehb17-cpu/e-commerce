import { sql } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';

export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to mark reviews helpful.', 401);
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!body?.reviewId) return fail('Missing review', 400);

  const existing = await sql`select 1 from review_helpful where review_id = ${body.reviewId} and customer_id = ${customer.id}`;
  if (existing[0]) {
    await sql`delete from review_helpful where review_id = ${body.reviewId} and customer_id = ${customer.id}`;
    const r = await sql`update reviews set helpful_count = greatest(0, helpful_count - 1) where id = ${body.reviewId} returning helpful_count`;
    return ok({ helpful: false, count: r[0]?.helpful_count ?? 0 });
  }
  await sql`insert into review_helpful (review_id, customer_id) values (${body.reviewId}, ${customer.id}) on conflict do nothing`;
  const r = await sql`update reviews set helpful_count = helpful_count + 1 where id = ${body.reviewId} returning helpful_count`;
  return ok({ helpful: true, count: r[0]?.helpful_count ?? 0 });
}
