import { sql, rateLimit } from '@/lib/db';
import { fail, json, parse, schemas } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { loadCart } from '@/lib/cart';
import { generateOrderNumber } from '@/lib/orders';
import { sendMail, templates } from '@/lib/email';
import { getSetting } from '@/lib/settings';

export const runtime = 'nodejs';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  if (!rateLimit(`checkout:${ip}`, 8, 60_000).ok) return fail('Too many checkout attempts. Try again shortly.', 429);

  const { data, error } = await parse(request, schemas.checkout);
  if (error) return fail(error, 422);

  const customer = await getCurrentCustomer();
  const { cart, items, totals } = await loadCart(customer?.id || null);
  if (!cart || items.length === 0) return fail('Your bag is empty.', 400);
  if (totals.couponError) return fail(totals.couponError, 400);

  const payments = await getSetting('payments');
  if (data.paymentMethod === 'cod' && !payments.cod) return fail('Cash on delivery is currently unavailable.', 400);

  for (const it of items) {
    if (it.qty > it.stock) return fail(`${it.name} only has ${it.stock} left in stock.`, 409);
  }

  const currencyRows = await sql`select code, rate_to_base, decimals from currencies where code = ${data.currency} and is_active limit 1`;
  const cur = currencyRows[0];
  if (!cur) return fail('Unsupported currency.', 400);

  const recalculated = await (async () => {
    const { computeTotals } = await import('@/lib/cart');
    return computeTotals(items, data.couponCode || cart.coupon_code, { shippingMethod: data.shippingMethod });
  })();

  const rate = Number(cur.rate_to_base);
  const displayTotal = Math.round((recalculated.total / 100 / rate) * 10 ** (cur.decimals ?? 2) * 100);

  // Re-validate everything inside a transaction so stock and coupons stay consistent.
  const result = await sql.begin(async (tx) => {
    let orderRow;
    for (let attempt = 0; attempt < 3 && !orderRow; attempt++) {
      try {
        const rows = await tx`
          insert into orders (order_number, customer_id, email, phone, status, payment_method, currency, fx_rate,
            subtotal, discount_total, shipping_total, tax_total, grand_total, display_total, coupon_code,
            shipping_address, billing_address, notes)
          values (${generateOrderNumber()}, ${customer?.id || null}, ${data.email}, ${data.phone}, 'pending',
            ${data.paymentMethod}, ${cur.code}, ${rate}, ${recalculated.subtotal}, ${recalculated.discount},
            ${recalculated.shipping}, ${recalculated.tax}, ${recalculated.total}, ${displayTotal},
            ${recalculated.coupon?.code || null},
            ${tx.json({ full_name: data.fullName, phone: data.phone, line1: data.line1, line2: data.line2 || '', city: data.city, state: data.state || '', postal_code: data.postalCode || '', country: data.country })},
            ${tx.json({ full_name: data.fullName, line1: data.line1, city: data.city, country: data.country })},
            ${data.notes || null})
          returning *
        `;
        orderRow = rows[0];
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }

    for (const it of items) {
      await tx`
        insert into order_items (order_id, product_id, variant_id, name, variant_name, sku, image_url, qty, unit_price, line_total)
        values (${orderRow.id}, ${it.product_id}, ${it.variant_id}, ${it.name}, ${it.variant_name},
          ${null}, ${it.image}, ${it.qty}, ${it.unit_price}, ${it.line_total})
      `;
      const dec = await tx`
        update products set stock = stock - ${it.qty}, sold_count = sold_count + ${it.qty}, updated_at = now()
        where id = ${it.product_id} and stock >= ${it.qty} returning id
      `;
      if (!dec[0]) throw new Error(`OUT_OF_STOCK:${it.name}`);
      if (it.variant_id) {
        await tx`update product_variants set stock = greatest(0, stock - ${it.qty}) where id = ${it.variant_id}`;
      }
      await tx`insert into stock_adjustments (product_id, variant_id, delta, reason, actor) values (${it.product_id}, ${it.variant_id}, ${-it.qty}, 'order', ${orderRow.order_number})`;
    }

    await tx`insert into order_events (order_id, status, note, actor) values (${orderRow.id}, 'pending', 'Order placed', 'customer')`;

    if (recalculated.coupon?.code) {
      await tx`update coupons set used_count = used_count + 1 where upper(code) = upper(${recalculated.coupon.code})`;
    }

    if (data.saveAddress && customer) {
      await tx`
        insert into addresses (customer_id, full_name, phone, line1, line2, city, state, postal_code, country)
        values (${customer.id}, ${data.fullName}, ${data.phone}, ${data.line1}, ${data.line2 || null}, ${data.city}, ${data.state || null}, ${data.postalCode || null}, ${data.country})
      `;
    }

    await tx`delete from cart_items where cart_id = ${cart.id}`;
    await tx`update carts set coupon_code = null where id = ${cart.id}`;
    return orderRow;
  }).catch((e) => {
    if (String(e.message).startsWith('OUT_OF_STOCK:')) return { error: e.message.split(':')[1] };
    throw e;
  });

  if (result?.error) return fail(`${result.error} just sold out. Please adjust your bag.`, 409);

  // Emails are best-effort and never block the order.
  const tpl = templates.order_placed({ name: data.fullName, order: result, items });
  sendMail({ to: data.email, subject: tpl.subject, html: tpl.html, template: 'order_placed', orderId: result.id }).catch(() => {});
  const emailSettings = await getSetting('email');
  if (emailSettings.notify_admin && process.env.ORDER_NOTIFICATION_EMAIL) {
    const adminTpl = templates.admin_new_order({ order: result, items });
    sendMail({ to: process.env.ORDER_NOTIFICATION_EMAIL, subject: adminTpl.subject, html: adminTpl.html, template: 'admin_new_order', orderId: result.id }).catch(() => {});
  }

  return json({ ok: true, orderNumber: result.order_number, total: result.grand_total, currency: result.currency, displayTotal: result.display_total });
}
