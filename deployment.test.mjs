// Run after npm run build. Uses a disposable database; never touches your app data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import webpush from 'web-push';

const temp = await mkdtemp(path.join(tmpdir(), 'qareeb-deploy-'));
const keys = webpush.generateVAPIDKeys();
Object.assign(process.env, {
  NODE_ENV: 'production', DATABASE_URL: '', LOCAL_DATABASE_PATH: ':memory:', VERCEL: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
  UPLOADS_DIR: `${temp}/uploads`, JWT_SECRET: 'isolated-deployment-test-secret-not-for-real-use',
  PUBLIC_URL: '', CORS_ORIGINS: 'https://qareeb-test.vercel.app',
  DEMO_PASSWORD: 'password123', VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey,
});
let server, database, base, customer;
const origin = process.env.CORS_ORIGINS;
async function request(url, token, body) {
  const response = await fetch(base + url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.ok(response.ok, `${url}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
before(async () => {
  database = await import('../server/dist/db/index.js');
  await database.runMigrations();
  await (await import('../server/dist/db/seed.js')).seedIfEmpty();
  (await import('../server/dist/lib/push.js')).initPush();
  server = http.createServer((await import('../server/dist/app.js')).createApp());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  customer = await request('/api/auth/login', null, { email: 'ali@demo.com', password: 'password123' });
});
after(async () => {
  server?.closeAllConnections();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await database?.closeDatabase();
  await rm(temp, { recursive: true, force: true });
});

test('demo logins are advertised so hosted Vercel works immediately', async () => {
  const data = await request('/api/config');
  assert.equal(data.demo.password, 'password123');
});
test('health and cross-origin API responses', async () => {
  const res = await fetch(base + '/api/health', { headers: { Origin: origin } });
  assert.equal(res.headers.get('access-control-allow-origin'), origin);
  assert.equal((await res.json()).ok, true);
  const preflight = await fetch(base + '/api/auth/login', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
});
test('production SPA supports direct links; API 404 stays JSON', async () => {
  for (const route of ['/', '/orders', '/profile', '/merchant']) {
    const res = await fetch(base + route);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<div id="root"><\/div>/);
  }
  const res = await fetch(base + '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.ok((await res.json()).error);
});
test('all four roles log in and load their dashboard data', async () => {
  for (const [email, role, endpoint] of [
    ['ali@demo.com', 'CUSTOMER', '/api/orders'],
    ['madina@demo.com', 'MERCHANT', '/api/merchant/orders'],
    ['rider1@demo.com', 'RUNNER', '/api/runner/deliveries'],
    ['admin@qareeb.app', 'ADMIN', '/api/admin/stats'],
  ]) {
    const session = await request('/api/auth/login', null, { email, password: 'password123' });
    assert.equal(session.user.role, role);
    await request(endpoint, session.token);
  }
});
test('customer cannot access admin data', async () => {
  const res = await fetch(base + '/api/admin/stats', { headers: { Authorization: `Bearer ${customer.token}` } });
  assert.equal(res.status, 403);
});
test('shops, saved addresses and seeded orders load', async () => {
  const data = await request('/api/shops?lat=34.1688&lng=73.2215');
  assert.ok(data.shops.length > 0);
  assert.ok((await request('/api/users/me/addresses', customer.token)).length > 0);
  assert.ok((await request('/api/orders', customer.token)).length > 0);
});
test('authenticated image upload can be retrieved cross-origin', async () => {
  const form = new FormData();
  const image = await readFile(new URL('../client/public/icons/icon-192.png', import.meta.url));
  form.append('file', new Blob([image], { type: 'image/png' }), 'test.png');
  const res = await fetch(base + '/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${customer.token}` }, body: form });
  assert.equal(res.status, 201);
  const { url } = await res.json();
  const uploaded = await fetch(base + url, { headers: { Origin: origin } });
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.equal((await uploaded.arrayBuffer()).byteLength, image.length);
});
test('durable events survive separate polls and are private to their recipients', async () => {
  const { emitToUser, emitToOrder, emitToAdmins } = await import('../server/dist/socket.js');
  const baseline = await request('/api/realtime', customer.token);
  const other = await request('/api/auth/login', null, { email: 'sara@demo.com', password: 'password123' });
  const orders = await request('/api/orders', customer.token);
  await emitToUser(customer.user.id, 'test:private', { secret: 'customer-only' });
  await emitToOrder(orders[0].id, 'test:order', { secret: 'order-only' });
  await emitToAdmins('test:admin', { secret: 'admin-only' });
  const url = `/api/realtime?cursor=${baseline.cursor}&orders=${orders[0].id}`;
  const own = await request(url, customer.token);
  assert.ok(own.events.some(e => e.event === 'test:private'));
  assert.ok(own.events.some(e => e.event === 'test:order'));
  assert.ok(!own.events.some(e => e.event === 'test:admin'));
  const unauthorized = await request(url, other.token);
  assert.equal(unauthorized.events.length, 0);
  const anonymous = await fetch(base + url);
  assert.equal(anonymous.status, 401);
});
test('Vercel deploys the frontend AND serverless API from the repository root', async () => {
  const root = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
  assert.equal(root.buildCommand, 'npm run build');
  assert.equal(root.outputDirectory, 'client/dist');
  assert.ok(root.functions['api/index.js']);
  assert.equal(root.rewrites[0].source, '/api/:path*');
});
test('schema migration can run again without destroying data', async () => {
  await database.runMigrations();
  const data = await request('/api/shops');
  assert.equal(data.shops.length, 10);
});
test('checkout, merchant acceptance, chat, runner GPS and delivery flow', async () => {
  const merchant = await request('/api/auth/login', null, { email: 'madina@demo.com', password: 'password123' });
  const rider = await request('/api/auth/login', null, { email: 'rider1@demo.com', password: 'password123' });
  const hours = Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day => [day, { open: '00:00', close: '00:00' }]));
  await fetch(base + '/api/merchant/shop', { method: 'PATCH', headers: { Authorization: `Bearer ${merchant.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ hours, isOpen: true }) });
  const shop = await request('/api/shops/madina');
  const product = shop.products.find(p => p.isAvailable && p.stock > 5);
  assert.ok(product);
  const address = (await request('/api/users/me/addresses', customer.token))[0];
  const quantity = Math.min(product.stock, Math.max(1, Math.ceil(600 / product.price)));
  const payload = { addressId: address.id, shops: [{ shopId: shop.id, items: [{ productId: product.id, quantity }] }], paymentMethod: 'COD' };
  const placed = await request('/api/orders/checkout', customer.token, payload);
  const order = placed.orders[0];
  assert.equal(order.status, 'PENDING');
  const accepted = await request(`/api/merchant/orders/${order.id}/status`, merchant.token, { status: 'ACCEPTED' });
  assert.equal(accepted.status, 'ACCEPTED');
  await request(`/api/merchant/orders/${order.id}/assign`, merchant.token, { runnerId: rider.user.id });
  const chat = await request(`/api/orders/${order.id}/messages`, customer.token, { body: 'Deployment smoke test message' });
  assert.ok(chat.id);
  const baseline = await request('/api/realtime', customer.token);
  await request('/api/runner/location', rider.token, { lat: 34.18, lng: 73.24 });
  const events = await request(`/api/realtime?cursor=${baseline.cursor}&orders=${order.id}`, customer.token);
  assert.ok(events.events.some(e => e.event === 'runner:location' && e.payload.orderId === order.id));
  await request(`/api/merchant/orders/${order.id}/status`, merchant.token, { status: 'PREPARING' });
  await request(`/api/merchant/orders/${order.id}/status`, merchant.token, { status: 'READY' });
  await request(`/api/runner/deliveries/${order.id}/status`, rider.token, { status: 'ON_THE_WAY' });
  const delivered = await request(`/api/runner/deliveries/${order.id}/status`, rider.token, { status: 'DELIVERED' });
  assert.equal(delivered.paymentStatus, 'PAID');
  await request(`/api/orders/${order.id}/review`, customer.token, { shopRating: 5, runnerRating: 5 });
});

test('hosted image upload uses Supabase Storage and keeps the key server-side', async () => {
  let received;
  const storage = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received = { path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks) };
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"Key":"test"}');
    });
  });
  storage.listen(0, '127.0.0.1'); await once(storage, 'listening');
  const { config } = await import('../server/dist/config.js');
  const oldUrl = config.supabaseUrl, oldKey = config.supabaseServiceKey;
  config.supabaseUrl = `http://127.0.0.1:${storage.address().port}`;
  config.supabaseServiceKey = 'test-backend-key-never-public';
  try {
    const image = await readFile(new URL('../client/public/icons/icon-192.png', import.meta.url));
    const form = new FormData(); form.append('file', new Blob([image], { type: 'image/png' }), 'test.png');
    const res = await fetch(base + '/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${customer.token}` }, body: form });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.url, /\/storage\/v1\/object\/public\/qareeb-images\//);
    assert.equal(received.headers.authorization, 'Bearer test-backend-key-never-public');
    assert.equal(received.method, 'POST');
    assert.equal(received.body.length, image.length);
    assert.ok(!JSON.stringify(body).includes(config.supabaseServiceKey));
    assert.ok(!JSON.stringify(await request('/api/config')).includes(config.supabaseServiceKey));
  } finally {
    config.supabaseUrl = oldUrl; config.supabaseServiceKey = oldKey;
    storage.closeAllConnections(); await new Promise(resolve => storage.close(resolve));
  }
});
test('Vercel image upload stores files in Postgres without extra keys', async () => {
  const { config } = await import('../server/dist/config.js');
  const old = config.isVercel;
  config.isVercel = true;
  try {
    const image = await readFile(new URL('../client/public/icons/icon-192.png', import.meta.url));
    const form = new FormData();
    form.append('file', new Blob([image], { type: 'image/png' }), 'test.png');
    const res = await fetch(base + '/api/uploads', { method: 'POST', headers: { Authorization: `Bearer ${customer.token}` }, body: form });
    assert.equal(res.status, 201);
    const { url } = await res.json();
    assert.match(url, /^\/api\/uploads\//);
    const uploaded = await fetch(base + url);
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.headers.get('content-type'), 'image/png');
    assert.equal((await uploaded.arrayBuffer()).byteLength, image.length);
  } finally {
    config.isVercel = old;
  }
});
test('login throttling counters are shared by independent store instances', async () => {
  const { PostgresRateLimitStore } = await import('../server/dist/lib/rate-limit-store.js');
  const a = new PostgresRateLimitStore('test'), b = new PostgresRateLimitStore('test');
  assert.equal((await a.increment('same-user')).totalHits, 1);
  assert.equal((await b.increment('same-user')).totalHits, 2);
  await b.resetKey('same-user');
  assert.equal((await a.increment('same-user')).totalHits, 1);
});
