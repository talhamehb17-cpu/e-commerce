import { cookies } from 'next/headers';
import { sql, randomToken, sha256 } from './db.js';

export const CUSTOMER_COOKIE = 'nova_session';
export const ADMIN_COOKIE = 'nova_admin';
export const CART_COOKIE = 'nova_cart';
const SESSION_DAYS = 30;

export async function createSession(subjectType, subjectId, userAgent = '', ip = '') {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await sql`
    insert into sessions (token_hash, subject_type, subject_id, user_agent, ip, expires_at)
    values (${sha256(token)}, ${subjectType}, ${subjectId}, ${userAgent.slice(0, 300)}, ${ip.slice(0, 80)}, ${expires})
  `;
  return { token, expires };
}

export async function setSessionCookie(token, expires, isAdmin = false) {
  const store = await cookies();
  store.set(isAdmin ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function destroySession(isAdmin = false) {
  const store = await cookies();
  const name = isAdmin ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = store.get(name)?.value;
  if (token) {
    await sql`update sessions set revoked_at = now() where token_hash = ${sha256(token)}`.catch(() => {});
  }
  store.delete(name);
}

async function readSession(name, subjectType) {
  const store = await cookies();
  const token = store.get(name)?.value;
  if (!token) return null;
  try {
    const rows = await sql`
      select s.id as session_id, s.subject_id, s.expires_at
      from sessions s
      where s.token_hash = ${sha256(token)}
        and s.subject_type = ${subjectType}
        and s.revoked_at is null
        and s.expires_at > now()
      limit 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function getCurrentCustomer() {
  const s = await readSession(CUSTOMER_COOKIE, 'customer');
  if (!s) return null;
  const rows = await sql`
    select id, name, email, phone, avatar_url, email_verified, theme_palette, theme_mode,
           currency, is_blocked, created_at
    from customers where id = ${s.subject_id} limit 1
  `;
  const c = rows[0];
  if (!c || c.is_blocked) return null;
  return c;
}

export async function getCurrentAdmin() {
  const s = await readSession(ADMIN_COOKIE, 'admin');
  if (!s) return null;
  const rows = await sql`
    select id, name, email, role, permissions, avatar_url, is_active
    from admins where id = ${s.subject_id} and is_active limit 1
  `;
  return rows[0] || null;
}

const ROLE_PERMISSIONS = {
  // Managers run the store day to day but cannot touch store-wide settings.
  manager: ['products:read', 'products:write', 'orders:read', 'orders:write', 'customers:read', 'customers:write',
    'reviews:read', 'reviews:write', 'content:read', 'content:write', 'settings:read'],
  // Staff work orders and customers only.
  staff: ['products:read', 'orders:read', 'orders:write', 'customers:read', 'customers:write', 'reviews:read'],
  // Viewers can look but never change anything.
  viewer: ['products:read', 'orders:read', 'customers:read', 'reviews:read', 'content:read', 'settings:read'],
};

export function can(admin, perm) {
  if (!admin) return false;
  if (admin.role === 'owner') return true;
  const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
  if (perms.includes('*') || perms.includes(perm)) return true;
  return (ROLE_PERMISSIONS[admin.role] || []).includes(perm);
}

export async function requireAdmin(perm) {
  const admin = await getCurrentAdmin();
  if (!admin) return { admin: null, error: 'unauthenticated', status: 401 };
  if (perm && !can(admin, perm)) return { admin, error: 'forbidden', status: 403 };
  return { admin, error: null, status: 200 };
}

/* ---------------- cart token ---------------- */
export async function getCartToken(create = false) {
  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value;
  if (!token && create) {
    token = randomToken(18);
    store.set(CART_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 120,
    });
  }
  return token || null;
}

export async function ensureCart(customerId = null) {
  let token = await getCartToken(true);
  const existing = await sql`select id, customer_id from carts where token = ${token} limit 1`;
  if (existing[0]) {
    if (customerId && !existing[0].customer_id) {
      await sql`update carts set customer_id = ${customerId}, updated_at = now() where id = ${existing[0].id}`;
    }
    return { id: existing[0].id, token };
  }
  const rows = await sql`
    insert into carts (token, customer_id) values (${token}, ${customerId}) returning id
  `;
  return { id: rows[0].id, token };
}

export async function getCart(customerId = null) {
  const token = await getCartToken(false);
  if (!token) return null;
  const rows = await sql`
    select id, customer_id, coupon_code from carts where token = ${token} limit 1
  `;
  return rows[0] || null;
}

/** Move items from the guest cart cookie into the signed-in customer's cart. */
export async function mergeGuestCart(customerId) {
  const token = await getCartToken(false);
  if (!token || !customerId) return;
  try {
    const guest = await sql`select id from carts where token = ${token} and customer_id is null limit 1`;
    if (!guest[0]) return;
    const owned = await sql`select id from carts where customer_id = ${customerId} order by created_at limit 1`;
    if (!owned[0]) {
      await sql`update carts set customer_id = ${customerId}, updated_at = now() where id = ${guest[0].id}`;
      return;
    }
    const items = await sql`select product_id, variant_id, qty, unit_price, gift_note from cart_items where cart_id = ${guest[0].id}`;
    for (const it of items) {
      const same = await sql`
        select id, qty from cart_items
        where cart_id = ${owned[0].id} and product_id = ${it.product_id}
          and (variant_id is not distinct from ${it.variant_id}) limit 1`;
      if (same[0]) {
        await sql`update cart_items set qty = least(20, ${same[0].qty + it.qty}) where id = ${same[0].id}`;
      } else {
        await sql`insert into cart_items (cart_id, product_id, variant_id, qty, unit_price, gift_note)
          values (${owned[0].id}, ${it.product_id}, ${it.variant_id}, ${it.qty}, ${it.unit_price}, ${it.gift_note})`;
      }
    }
    await sql`delete from carts where id = ${guest[0].id}`;
  } catch { /* best effort */ }
}
