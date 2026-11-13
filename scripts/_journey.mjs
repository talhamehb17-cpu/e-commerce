const BASE = 'http://localhost:3000';
const jar = new Map();
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie: ch(), ...(opts.headers || {}) }, redirect: 'manual' });
  for (const c of (res.headers.getSetCookie?.() || [])) { const [p] = c.split(';'); const i = p.indexOf('='); jar.set(p.slice(0, i), p.slice(i + 1)); }
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t.slice(0, 100); }
  return { status: res.status, data: d };
}
const out = (l, r, extra = '') => console.log(String(l).padEnd(23), r.status, JSON.stringify(r.data).slice(0, 190), extra);
const email = `journey${Date.now()}@example.com`;

let r = await call('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Journey Tester', email, password: 'TestPass2026!' }) });
out('register', r, r.data.devCode ? '(devCode ' + r.data.devCode + ')' : '');
const otp = r.data.devCode;

const prod = (await call('/api/search?q=aurora')).data.products[0];
console.log('product', prod.name, prod.price);

out('cart add', await call('/api/cart', { method: 'POST', body: JSON.stringify({ productId: prod.id, qty: 2 }) }));
out('cart get', await call('/api/cart'));
out('coupon WELCOME10', await call('/api/cart/coupon', { method: 'POST', body: JSON.stringify({ code: 'WELCOME10' }) }));
out('coupon BADCODE', await call('/api/cart/coupon', { method: 'POST', body: JSON.stringify({ code: 'NOPE123' }) }));
out('wishlist', await call('/api/wishlist', { method: 'POST', body: JSON.stringify({ productId: prod.id }) }));
if (otp) out('verify email', await call('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code: otp, purpose: 'verify_email' }) }));

const checkout = await call('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({
    email, phone: '+92 300 1234567', fullName: 'Journey Tester', line1: '12 Test Street', city: 'Lahore',
    country: 'Pakistan', paymentMethod: 'cod', currency: 'USD', shippingMethod: 'standard', saveAddress: true,
    couponCode: 'WELCOME10', notes: 'Leave at reception',
  }),
});
out('checkout', checkout);
const orderNumber = checkout.data.orderNumber || checkout.data.order?.order_number;
if (orderNumber) {
  out('order lookup', await call(`/api/orders?number=${orderNumber}`));
  out('order list', await call('/api/orders'));
  out('review', await call('/api/reviews', { method: 'POST', body: JSON.stringify({ productId: prod.id, rating: 5, title: 'Excellent', body: 'Really solid build quality and fast delivery.' }) }));
  out('reviews list', await call(`/api/reviews?productId=${prod.id}`));
  out('addresses', await call('/api/account/addresses'));
  out('prefs', await call('/api/account/preferences', { method: 'POST', body: JSON.stringify({ currency: 'GBP' }) }));
  out('contact', await call('/api/contact', { method: 'POST', body: JSON.stringify({ name: 'Journey', email, subject: 'Test', message: 'Hello, testing the contact form.' }) }));
  out('newsletter', await call('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) }));
  out('track', await call('/api/track', { method: 'POST', body: JSON.stringify({ path: '/shop' }) }));
  console.log('ORDER_NUMBER=' + orderNumber);
}
