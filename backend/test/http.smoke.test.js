// Smoke HTTP de la API: levanta la app real en un puerto efímero contra una
// base temporal, para cubrir el cableado de Express, los middlewares (auth
// admin) y el contrato de respuestas, no solo los controllers en aislamiento.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dbPath = path.join(os.tmpdir(), `compushop-http-${process.pid}.db`);
process.env.DB_PATH = dbPath;
// Sin VERCEL, src/index.js abre el puerto 4000 al importarse; el test prefiere
// su propio server efímero. VERCEL=1 exporta la app sin hacer listen.
process.env.VERCEL = '1';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const seedPath = path.join(process.cwd(), 'src', 'db', 'seed.js');
execFileSync(process.execPath, [seedPath], { env: process.env, stdio: 'inherit' });

const app = require('../src/index');

let server;
let baseUrl;
let token;

before(async () => {
  server = await new Promise((resolve, reject) => {
    const s = app.listen(0, () => resolve(s));
    s.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@compushop.com', password: 'admin123' }),
  });
  assert.equal(res.status, 200, 'el login admin debe responder 200');
  const body = await res.json();
  token = body.token;
  assert.ok(token, 'el login debe devolver token');
});

after(() => new Promise((resolve) => server.close(resolve)));

function adminHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

test('health: GET / responde ok', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('catalogo publico: listado paginado y detalle por id/slug', async () => {
  const listRes = await fetch(`${baseUrl}/api/products?limit=2`);
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.equal(list.products.length, 2);
  assert.equal(list.pagination.total, 12);

  const byId = await fetch(`${baseUrl}/api/products/1`);
  assert.equal(byId.status, 200);
  assert.equal((await byId.json()).product.slug, 'notebook-lenovo-ideapad-3');

  const bySlug = await fetch(`${baseUrl}/api/products/notebook-lenovo-ideapad-3`);
  assert.equal(bySlug.status, 200);
  assert.equal((await bySlug.json()).product.id, 1);

  const missing = await fetch(`${baseUrl}/api/products/no-existe`);
  assert.equal(missing.status, 404);

  const categories = await fetch(`${baseUrl}/api/categories`);
  assert.equal(categories.status, 200);
  assert.equal((await categories.json()).categories.length, 6);

  const services = await fetch(`${baseUrl}/api/services`);
  assert.equal(services.status, 200);
  assert.equal((await services.json()).services.length, 4);
});

test('auth: las rutas admin sin token responden 401', async () => {
  for (const path of ['/api/settings', '/api/dashboard/stats', '/api/users']) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.status, 401, `${path} debe exigir token`);
  }
});

test('admin: settings y dashboard responden con token', async () => {
  const settings = await fetch(`${baseUrl}/api/settings`, { headers: adminHeaders() });
  assert.equal(settings.status, 200);
  assert.ok(Object.keys((await settings.json()).settings).length > 0);

  const dashboard = await fetch(`${baseUrl}/api/dashboard/stats`, { headers: adminHeaders() });
  assert.equal(dashboard.status, 200);
  const stats = (await dashboard.json()).stats;
  assert.equal(stats.productsCount, 12);
  assert.equal(stats.servicesCount, 4);
});

test('CRUD round-trip de producto por HTTP', async () => {
  const created = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name: 'Producto Smoke HTTP', price: 12345, stock: 3 }),
  });
  assert.equal(created.status, 201);
  const { product } = await created.json();
  assert.ok(product.id > 12);
  assert.equal(product.slug, 'producto-smoke-http');

  const updated = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ price: 9999 }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).product.price, 9999);

  const reread = await fetch(`${baseUrl}/api/products/${product.id}`);
  assert.equal((await reread.json()).product.price, 9999);

  const removed = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  assert.equal(removed.status, 200);

  const gone = await fetch(`${baseUrl}/api/products/${product.id}`);
  assert.equal(gone.status, 404);

  const list = await (await fetch(`${baseUrl}/api/products?limit=1`)).json();
  assert.equal(list.pagination.total, 12, 'el catalogo vuelve al estado del seed');
});

test('pedido: crear un pedido descuenta stock y registra items', async () => {
  const before = await (await fetch(`${baseUrl}/api/products/1`)).json();
  const stockAntes = before.product.stock;

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 1, name: 'Notebook Lenovo', price: 689999, quantity: 2, type: 'product' }],
      customer_name: 'Pedido E2E',
      customer_email: 'pedido@e2e.com',
    }),
  });
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.equal(order.order_number.slice(0, 2), 'CS');
  assert.equal(order.status, 'confirmed');
  assert.equal(order.total, 689999 * 2);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 2);

  const after = await (await fetch(`${baseUrl}/api/products/1`)).json();
  assert.equal(after.product.stock, stockAntes - 2, 'el stock debe descontarse exactamente 2');
});

test('pedido: si no hay stock suficiente no queda nada a medias', async () => {
  const before = await (await fetch(`${baseUrl}/api/products/1`)).json();
  const stockAntes = before.product.stock;

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 1, name: 'Notebook Lenovo', price: 689999, quantity: stockAntes + 1, type: 'product' }],
      customer_name: 'Pedido Fallido',
      customer_email: 'fallido@e2e.com',
    }),
  });
  assert.equal(res.status, 400, 'debe rechazarse por stock insuficiente');

  const after = await (await fetch(`${baseUrl}/api/products/1`)).json();
  assert.equal(after.product.stock, stockAntes, 'el stock no debe cambiar si el pedido falla');

  // Sin orden ni items fantasma: el catalogo y los pedidos quedan consistentes
  const orders = await (await fetch(`${baseUrl}/api/orders`, { headers: adminHeaders() })).json();
  assert.ok(
    !orders.orders.some((o) => o.customer_email === 'fallido@e2e.com'),
    'no debe quedar la orden fallida'
  );
});

test('persistencia: los cambios quedan escritos en el archivo de la base', async () => {
  const created = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name: 'Producto Persistido', price: 555, stock: 1 }),
  });
  const { product } = await created.json();

  // Un proceso aparte lee el .db del disco: verifica que la escritura llego al
  // archivo y no solo a la copia en memoria de este proceso.
  const script = `
    const db = require(${JSON.stringify(path.join(process.cwd(), 'src', 'db', 'database.js'))});
    db.init().then(() => {
      const row = db.prepare('SELECT name, price FROM products WHERE id = ?').get(${product.id});
      if (!row) {
        console.error('producto ausente en el archivo');
        process.exit(1);
      }
      console.log('disco: ' + row.name + ' ' + row.price);
    });
  `;
  const out = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf8',
  });
  assert.match(out, /disco: Producto Persistido 555/);

  const removed = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  assert.equal(removed.status, 200);
});
