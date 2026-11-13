const BASE = 'http://localhost:3000';
const jar = new Map();
const ch = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', cookie: ch(), ...(opts.headers || {}) } });
  for (const c of (res.headers.getSetCookie?.() || [])) { const [p] = c.split(';'); const i = p.indexOf('='); jar.set(p.slice(0, i), p.slice(i + 1)); }
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t.slice(0, 90); }
  return { status: res.status, data: d };
}
const out = (l, r) => console.log(String(l).padEnd(26), r.status, JSON.stringify(r.data).slice(0, 170));

out('admin login', await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) }));

const orders = await call('/api/admin/orders');
const order = orders.data.orders[0];
console.log('orders'.padEnd(26), orders.status, 'count', orders.data.total);
const detail = await call(`/api/admin/orders/${order.id}`);
console.log('order detail'.padEnd(26), detail.status, 'items', detail.data.order?.items?.length, 'events', detail.data.events?.length);

for (const st of ['confirmed', 'processing', 'packed', 'shipped', 'delivered']) {
  const r = await call(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: st, sendEmail: true, note: `Moved to ${st}` }) });
  console.log(('→ ' + st).padEnd(26), r.status, 'changed=' + r.data.changed, 'emailed=' + r.data.emailed);
}
const dup = await call(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'delivered', sendEmail: true }) });
console.log('duplicate status'.padEnd(26), dup.status, 'changed=' + dup.data.changed, 'emailed=' + dup.data.emailed);

// product CRUD
const cats = await call('/api/admin/categories');
const brands = await call('/api/admin/brands');
const created = await call('/api/admin/products', { method: 'POST', body: JSON.stringify({
  name: 'Admin Test Lamp', subtitle: 'Created by the journey test', description: 'A warm table lamp used to verify the admin flow.',
  categoryId: cats.data.categories[0].id, brandId: brands.data.brands[0].id, price: 12500, compareAtPrice: 15000,
  costPrice: 6000, stock: 7, lowStockThreshold: 5, sku: 'TEST-LAMP-1', badge: 'new', isFeatured: false, isActive: true,
  images: ['/images/products/electronics-1.jpg'], variants: [{ name: 'Warm', optionName: 'Light', priceDelta: 0, stock: 4, sku: 'TEST-W' }], tags: ['test'],
}) });
out('product create', created);
const pid = created.data.product?.id;
if (pid) {
  const get = await call(`/api/admin/products/${pid}`);
  console.log('product read'.padEnd(26), get.status, get.data.product?.name, 'images', get.data.product?.images?.length, 'variants', get.data.product?.variants?.length);
  out('product update', await call(`/api/admin/products/${pid}`, { method: 'PATCH', body: JSON.stringify({ price: 11900, stock: 12 }) }));
  out('inventory +3', await call('/api/admin/inventory', { method: 'PATCH', body: JSON.stringify({ productId: pid, delta: 3, reason: 'restock' }) }));
  out('bulk feature', await call('/api/admin/products/bulk', { method: 'POST', body: JSON.stringify({ ids: [pid], action: 'feature' }) }));
  out('product archive', await call(`/api/admin/products/${pid}`, { method: 'DELETE' }));
}

// content sections
const sections = await call('/api/admin/sections');
console.log('sections'.padEnd(26), sections.status, sections.data.sections?.length);
out('section create', await call('/api/admin/sections', { method: 'POST', body: JSON.stringify({ key: `test-${Date.now()}`, type: 'banner', title: 'Journey banner', isActive: true, position: 99, config: {} }) }));

// taxonomy
out('category create', await call('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: `Test Cat ${Date.now() % 1000}`, position: 90 }) }));
out('coupon create', await call('/api/admin/coupons', { method: 'POST', body: JSON.stringify({ code: `J${Date.now() % 10000}`, type: 'percent', value: 5, minSubtotal: 0, isActive: true }) }));

// reviews + customers + themes + settings + currencies
out('reviews', await call('/api/admin/reviews'));
out('customers', await call('/api/admin/customers'));
out('stats 7', await call('/api/admin/stats?range=7'));
out('themes', await call('/api/admin/themes'));
out('settings get', await call('/api/admin/settings'));
out('currencies', await call('/api/admin/currencies'));
out('email test', await call('/api/admin/email-test', { method: 'POST', body: '{}' }));
