import { sql, invalidate } from '@/lib/db';
import { fail, json, ok, parse, schemas } from '@/lib/api';
import { getCurrentCustomer, ensureCart, getCart } from '@/lib/auth';
import { loadCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const customer = await getCurrentCustomer();
  const data = await loadCart(customer?.id || null);
  return json({
    items: data.items,
    totals: data.totals,
    coupon: data.cart?.coupon_code || null,
  });
}

export async function POST(request) {
  const { data, error } = await parse(request, schemas.cartAdd);
  if (error) return fail(error, 422);
  const customer = await getCurrentCustomer();
  const cart = await ensureCart(customer?.id || null);

  const products = await sql`select id, name, price, stock, is_active from products where id = ${data.productId}`;
  const product = products[0];
  if (!product || !product.is_active) return fail('That product is no longer available.', 404);

  let unitPrice = Number(product.price);
  let stock = product.stock;
  if (data.variantId) {
    const variants = await sql`select id, price_delta, stock from product_variants where id = ${data.variantId} and product_id = ${data.productId}`;
    if (!variants[0]) return fail('That option is no longer available.', 404);
    unitPrice += Number(variants[0].price_delta);
    stock = variants[0].stock;
  }
  if (stock <= 0) return fail('That item is out of stock.', 409);

  const same = await sql`
    select id, qty from cart_items
    where cart_id = ${cart.id} and product_id = ${data.productId}
      and (variant_id is not distinct from ${data.variantId || null}) limit 1`;
  const qty = Math.min(20, (same[0]?.qty || 0) + data.qty);
  if (qty > stock) return fail(`Only ${stock} left in stock.`, 409);

  if (same[0]) {
    await sql`update cart_items set qty = ${qty} where id = ${same[0].id}`;
  } else {
    await sql`insert into cart_items (cart_id, product_id, variant_id, qty, unit_price, gift_note)
      values (${cart.id}, ${data.productId}, ${data.variantId || null}, ${qty}, ${unitPrice}, ${data.giftNote || null})`;
  }
  invalidate('');
  const fresh = await loadCart(customer?.id || null);
  return ok({ items: fresh.items, totals: fresh.totals, itemCount: fresh.totals.itemCount });
}

export async function PATCH(request) {
  const { data, error } = await parse(request, schemas.cartPatch);
  if (error) return fail(error, 422);
  const customer = await getCurrentCustomer();
  const cart = await getCart(customer?.id || null);
  if (!cart) return fail('Cart is empty', 404);

  const rows = await sql`select ci.id, ci.product_id, ci.variant_id from cart_items ci where ci.id = ${data.id} and ci.cart_id = ${cart.id}`;
  if (!rows[0]) return fail('Item not in your cart', 404);
  const stockRows = await sql`
    select coalesce((select stock from product_variants where id = ${rows[0].variant_id}), (select stock from products where id = ${rows[0].product_id})) as stock`;
  const stock = Number(stockRows[0]?.stock || 0);
  if (data.qty > stock) return fail(`Only ${stock} left in stock.`, 409);

  await sql`update cart_items set qty = ${data.qty} where id = ${data.id}`;
  invalidate('');
  const fresh = await loadCart(customer?.id || null);
  return ok({ items: fresh.items, totals: fresh.totals });
}

export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id');
  const customer = await getCurrentCustomer();
  const cart = await getCart(customer?.id || null);
  if (!cart) return fail('Cart is empty', 404);
  if (id) await sql`delete from cart_items where id = ${id} and cart_id = ${cart.id}`;
  else await sql`delete from cart_items where cart_id = ${cart.id}`;
  invalidate('');
  const fresh = await loadCart(customer?.id || null);
  return ok({ items: fresh.items, totals: fresh.totals });
}
