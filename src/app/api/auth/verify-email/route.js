import { sql } from '@/lib/db';
import { fail, ok, parse, schemas } from '@/lib/api';
import { verifyOtp } from '@/lib/otp';
import { getCurrentCustomer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { data, error } = await parse(request, schemas.otp);
  if (error) return fail(error, 422);
  const result = await verifyOtp(data.email, 'verify_email', data.code);
  if (!result.ok) return fail(result.error, 422);
  await sql`update customers set email_verified = true, email_verified_at = now(), updated_at = now() where email = ${data.email}`;
  const customer = await getCurrentCustomer();
  return ok({ verified: true, customer: customer ? { id: customer.id, verified: true } : null });
}
