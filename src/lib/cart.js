import { sql } from './db.js';
import { getCart } from './auth.js';
import { getSetting } from './settings.js';

/** Read a cart with joined product data and computed totals (base currency minor units). */
export async function loadCart(customerId = null) {
  const cart = await getCart(customerId);
  if (!cart) return { cart: null, items: [], totals: emptyTotals(), coupon: null };
  const items = await sql`
    select ci.id, ci.qty, ci.variant_id, ci.unit_price, ci.gift_note,
           p.id as product_id, p.slug, p.name, p.stock, p.material,
           v.name as variant_name, v.price_delta, v.stock as variant_stock,
           c.slug as category_slug,
           (select url from product_images pi where pi.product_id = p.id order by position limit 1) as image,
           (select count(*)::int from product_variants pv where pv.product_id = p.id) as variant_count
    from cart_items ci
    join products p on p.id = ci.product_id
    left join product_variants v on v.id = ci.variant_id
    left join categories c on c.id = p.category_id
    where ci.cart_id = ${cart.id}
    order by ci.created_at
  `;
  const { resolveImage } = await import('./catalog.js');
  const shaped = items.map((i) => ({
    ...i,
    image: resolveImage(i.image, i.category_slug),
    unit_price: Number(i.unit_price),
    line_total: Number(i.unit_price) * i.qty,
  }));
  const totals = await computeTotals(shaped, cart.coupon_code);
  return { cart, items: shaped, totals };
}

function emptyTotals() {
  return {
    subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0,
    itemCount: 0, freeShippingRemaining: 0, coupon: null, couponError: null, shippingMethod: 'standard',
  };
}

export async function computeTotals(items, couponCode, opts = {}) {
  const shipping = await getSetting('shipping');
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.qty, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  let discount = 0;
  let coupon = null;
  let couponError = null;
  let freeShip = false;

  if (couponCode) {
    const rows = await sql`select * from coupons where upper(code) = upper(${couponCode}) limit 1`;
    const c = rows[0];
    if (!c) couponError = 'That code is not recognised.';
    else if (!c.is_active) couponError = 'That code is no longer active.';
    else if (c.starts_at && new Date(c.starts_at) > new Date()) couponError = 'That code is not active yet.';
    else if (c.ends_at && new Date(c.ends_at) < new Date()) couponError = 'That code has expired.';
    else if (c.usage_limit && c.used_count >= c.usage_limit) couponError = 'That code has reached its limit.';
    else if (subtotal < Number(c.min_subtotal)) {
      couponError = `Spend ${formatBase(Number(c.min_subtotal) - subtotal)} more to use this code.`;
    } else {
      coupon = c;
      if (c.type === 'percent') discount = Math.round((subtotal * Number(c.value)) / 100);
      else if (c.type === 'fixed') discount = Math.min(Number(c.value), subtotal);
      else if (c.type === 'freeship') freeShip = true;
      if (c.max_discount) discount = Math.min(discount, Number(c.max_discount));
    }
  }

  const afterDiscount = Math.max(0, subtotal - discount);
  const method = opts.shippingMethod || 'standard';
  let shippingCost = 0;
  if (itemCount > 0) {
    if (freeShip || afterDiscount >= Number(shipping.free_threshold)) shippingCost = 0;
    else if (method === 'express') shippingCost = Number(shipping.express_rate);
    else shippingCost = Number(shipping.flat_rate);
  }
  const tax = Math.round((afterDiscount * Number(shipping.tax_percent || 0)) / 100);
  return {
    subtotal,
    discount,
    shipping: shippingCost,
    tax,
    total: Math.max(0, afterDiscount + shippingCost + tax),
    itemCount,
    freeShippingRemaining: Math.max(0, Number(shipping.free_threshold) - afterDiscount),
    freeThreshold: Number(shipping.free_threshold),
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: Number(coupon.value) } : null,
    couponError,
    shippingMethod: method,
  };
}

function formatBase(minor) {
  return `Rs ${(Number(minor) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export async function mergeGuestCart(customerId) {
  const { getCartToken } = await import('./auth.js');
  const token = await getCartToken(false);
  if (!token) return;
  const rows = await sql`select id from carts where token = ${token} limit 1`;
  if (!rows[0]) return;
  await sql`update carts set customer_id = ${customerId}, updated_at = now() where id = ${rows[0].id} and customer_id is null`;
}
