import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCurrentCustomer, getCurrentAdmin, can } from '@/lib/auth';
import { getObject } from '@/lib/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  const { submission } = await params;
  const [customer, admin] = await Promise.all([getCurrentCustomer(), getCurrentAdmin()]);
  const row = (await sql`select ps.proof_key, ps.customer_id, ps.order_id from payment_submissions ps where ps.id::text=${submission} limit 1`)[0];
  if (!row || !(admin && can(admin, 'orders:read')) && !(customer && row.customer_id === customer.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const response = await getObject(row.proof_key);
    if (!response.ok) return NextResponse.json({ error: 'Proof file is unavailable.' }, { status: 502 });
    const type = response.headers.get('content-type') || 'application/octet-stream';
    if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(type.split(';')[0])) return NextResponse.json({ error: 'Unsupported proof file.' }, { status: 415 });
    return new Response(response.body, { headers: { 'Content-Type': type, 'Content-Disposition': `${new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="payment-proof.${type.includes('pdf')?'pdf':'image'}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return NextResponse.json({ error: 'Proof file is unavailable.' }, { status: 502 }); }
}
