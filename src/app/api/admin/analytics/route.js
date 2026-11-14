import { guard } from '@/lib/admin';
import { fail, json } from '@/lib/api';
import { getAnalytics } from '@/lib/analytics';
import { cached, sql, rateLimit } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const { admin, error, status } = await guard('dashboard:read');
  if (error) return fail(error, status);
  if (!rateLimit(`admin-analytics:${admin.id}`, 60, 60_000).ok) return fail('Analytics requests are rate limited. Try again shortly.',429);
  const params = new URL(request.url).searchParams;
  const cacheKey = new URLSearchParams([...params.entries()].filter(([key]) => key !== 'format')).toString();
  const data = await cached(`admin-analytics:${cacheKey}`, 30_000, () => getAnalytics(params));
  if (params.get('format') === 'pdf') {
    const safe = value => String(value ?? '').replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, '\\$&');
    const lines = [
      'NOVA COMMERCE ANALYTICS REPORT', `Period: ${data.range.start} through ${data.range.end}`,
      'Money: base currency minor units; gross paid order values exclude cancelled/refunded status and are not refund-adjusted.',
      `Matching orders: ${data.totals.orders}`, `Gross paid order value: ${data.totals.revenue}`,
      `Outstanding unpaid amount: ${data.totals.outstanding}`, `Discounts recorded: ${data.totals.discounts}`,
      `Delivered orders: ${data.totals.delivered}`, `Units ordered (non-cancelled): ${data.totals.units}`,
      `Page views: ${data.traffic.pageViews}`, `Unique visitor-day hashes (not people): ${data.traffic.visitors}`,
      'Refund totals unavailable: no refund ledger exists in the current database schema.',
      data.traffic.eventTrackingAvailable ? 'Funnel tracking starts with current instrumentation; earlier funnel events unavailable.' : 'Funnel events unavailable because analytics_events schema migration has not run.',
      'Order details are available in the companion CSV export.',
    ];
    const stream = `BT /F1 11 Tf 52 760 Td 16 TL ${lines.map((line,i)=>`${i?'T* ':''}(${safe(line)}) Tj`).join(' ')} ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf='%PDF-1.4\n'; const offsets=[0];
    objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`});
    const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>`${String(x).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Response(Buffer.from(pdf,'ascii'),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="nova-analytics-summary.pdf"','Cache-Control':'no-store'}});
  }
  if (params.get('format') !== 'csv') return json(data);
  const statusFilter=params.get('status')||null, payment=params.get('payment')||null, campaign=params.get('campaign')||null, product=params.get('product')||null, category=params.get('category')||null;
  const rows = await sql`select o.order_number,o.placed_at,o.status,o.payment_status,o.payment_method,o.currency,o.grand_total,o.discount_total,o.coupon_code
    from orders o where o.placed_at >= ${data.range.start}::timestamptz and o.placed_at < ${data.range.end}::timestamptz
      and (${statusFilter}::text is null or o.status=${statusFilter}) and (${payment}::text is null or o.payment_method=${payment})
      and (${campaign}::text is null or o.coupon_code=${campaign})
      and (${product}::text is null or exists(select 1 from order_items oi where oi.order_id=o.id and oi.product_id::text=${product}))
      and (${category}::text is null or exists(select 1 from order_items oi join products p on p.id=oi.product_id where oi.order_id=o.id and p.category_id::text=${category}))
    order by o.placed_at desc limit 5000`;
  const fields=['order_number','placed_at','status','payment_status','payment_method','currency','grand_total','discount_total','coupon_code'];
  const escape=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv=[fields.join(','),...rows.map(r=>fields.map(k=>escape(r[k])).join(','))].join('\r\n');
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nova-analytics-orders.csv"','Cache-Control':'no-store'}});
}
