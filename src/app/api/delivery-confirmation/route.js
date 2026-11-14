import { sql } from '@/lib/db';
import { fail, json } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Claim a small batch of due reminders atomically. The lease prevents tabs/devices
 * from presenting the same queued reminder at the same time; the durable row remains
 * pending so refreshes and reconnects can reclaim it after the lease expires. */
export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return fail('Sign in to view delivery confirmations.', 401);
  try {
    const due = await sql`
      with candidates as (
        select dc.order_id
        from delivery_confirmations dc
        join orders o on o.id=dc.order_id
        where dc.customer_id=${customer.id} and dc.state='pending'
          and dc.due_at <= now() and o.status='out_for_delivery'
          and (dc.lease_until is null or dc.lease_until <= now())
        order by dc.due_at, dc.order_id
        limit 5
        for update of dc skip locked
      ), claimed as (
        update delivery_confirmations dc
        set lease_until=now()+interval '60 seconds', last_reminder_at=now(), reminder_count=reminder_count+1
        from candidates c where dc.order_id=c.order_id
        returning dc.order_id, dc.due_at
      )
      select o.id, o.order_number, o.status, c.due_at,
        coalesce(json_agg(json_build_object('name',oi.name,'qty',oi.qty,'image_url',oi.image_url)
          order by oi.id) filter(where oi.id is not null),'[]'::json) as items
      from claimed c join orders o on o.id=c.order_id
      left join order_items oi on oi.order_id=o.id
      group by o.id,o.order_number,o.status,c.due_at
      order by c.due_at, o.order_number
    `;
    return json({ notifications: due });
  } catch (error) {
    console.error('Delivery notification queue read failed:', error?.message || 'unknown error');
    return fail('Delivery reminders are temporarily unavailable. We will retry automatically.', 503);
  }
}
