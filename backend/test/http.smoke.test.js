// Smoke HTTP: levanta la app real en un puerto efimero y la golpea por HTTP.
// Cubre el cableado de Express, el middleware de auth y la forma de las
// respuestas, no la capa de datos (eso lo hace persistencia.smoke).
//
// Requieren TEST_DATABASE_URL (ver helpers.js). Sin esa variable se saltean.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { skip, useTestDatabase, runChild, DB_MODULE } = require('./helpers');

if (!skip) useTestDatabase();

// Sin esta bandera, src/index.js abre el puerto 4000 al importarse: el test
// prefiere su propio server efimero.
process.env.VERCEL = '1';

const app = require('../src/index');
const db = require('../src/db/database');

let server;
let baseUrl;
let token;

before(async () => {
  if (skip) return;

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

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
});

function adminHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

test('health: GET / responde ok', { skip }, async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('catalogo publico: listado paginado y detalle por id y por slug', { skip }, async () => {
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

test('busqueda: ILIKE no distingue mayusculas (lo que hacia LIKE en SQLite)', { skip }, async () => {
  const res = await fetch(`${baseUrl}/api/products?search=LENOVO`);
  assert.equal(res.status, 200);
  assert.ok((await res.json()).pagination.total > 0, 'LENOVO debe encontrar el producto');
});

test('auth: las rutas admin sin token responden 401', { skip }, async () => {
  for (const ruta of ['/api/settings', '/api/dashboard/stats', '/api/users']) {
    const res = await fetch(`${baseUrl}${ruta}`);
    assert.equal(res.status, 401, `${ruta} debe exigir token`);
  }
});

test('admin: settings y dashboard responden con token', { skip }, async () => {
  const settings = await fetch(`${baseUrl}/api/settings`, { headers: adminHeaders() });
  assert.equal(settings.status, 200);
  assert.ok(Object.keys((await settings.json()).settings).length > 0);

  const dashboard = await fetch(`${baseUrl}/api/dashboard/stats`, { headers: adminHeaders() });
  assert.equal(dashboard.status, 200);
  const stats = (await dashboard.json()).stats;
  assert.equal(stats.productsCount, 12);
  assert.equal(stats.servicesCount, 4);
});

test('CRUD round-trip de producto por HTTP', { skip }, async () => {
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

test('pedido: crearlo descuenta stock en la misma transaccion', { skip }, async () => {
  const antes = await (await fetch(`${baseUrl}/api/products/1`)).json();
  const stockAntes = antes.product.stock;

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
  assert.equal(Number(order.total), 1379998);
  assert.equal(order.items.length, 1);

  const despues = await (await fetch(`${baseUrl}/api/products/1`)).json();
  assert.equal(despues.product.stock, stockAntes - 2);
});

test('pedido: sin stock no queda nada escrito (rollback completo)', { skip }, async () => {
  const antes = await (await fetch(`${baseUrl}/api/products/1`)).json();
  const stockAntes = antes.product.stock;

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        { id: 1, name: 'Notebook Lenovo', price: 689999, quantity: stockAntes + 1, type: 'product' },
      ],
      customer_name: 'Pedido Fallido',
      customer_email: 'fallido@e2e.com',
    }),
  });
  assert.equal(res.status, 400, 'debe rechazarse por stock insuficiente');
  assert.match((await res.json()).error, /Stock insuficiente/);

  const despues = await (await fetch(`${baseUrl}/api/products/1`)).json();
  assert.equal(despues.product.stock, stockAntes, 'el stock no cambia si el pedido falla');

  const orders = await (await fetch(`${baseUrl}/api/orders`, { headers: adminHeaders() })).json();
  assert.ok(
    !orders.orders.some((o) => o.customer_email === 'fallido@e2e.com'),
    'no debe quedar la orden fallida'
  );
});

test('pedido: cancelar repone stock, repetir no duplica y reabrir lo descuenta', { skip }, async () => {
  const leerStock = async () =>
    Number((await (await fetch(`${baseUrl}/api/products/1`)).json()).product.stock);

  const stockOriginal = await leerStock();

  const res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 1, name: 'Notebook Lenovo', price: 689999, quantity: 2, type: 'product' }],
      customer_name: 'Pedido Cancelable',
      customer_email: 'cancelable@e2e.com',
    }),
  });
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.equal(order.status, 'confirmed');
  assert.equal(await leerStock(), stockOriginal - 2, 'crear descuenta stock');

  const cambiar = (status) =>
    fetch(`${baseUrl}/api/orders/${order.id}/status`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ status }),
    });

  const cancelada = await cambiar('cancelled');
  assert.equal(cancelada.status, 200);
  assert.equal((await cancelada.json()).order.status, 'cancelled');
  assert.equal(await leerStock(), stockOriginal, 'cancelar debe reponer el stock');

  // Mismo estado: no debe mover stock otra vez (doble reposicion = inflar inventario).
  const repetida = await cambiar('cancelled');
  assert.equal(repetida.status, 200);
  assert.equal(await leerStock(), stockOriginal, 'cancelar dos veces no duplica la reposicion');

  const reabierta = await cambiar('confirmed');
  assert.equal(reabierta.status, 200);
  assert.equal(await leerStock(), stockOriginal - 2, 'reabrir debe volver a descontar');
});

test('pedido: reabrir sin stock responde 409 y no cambia nada', { skip }, async () => {
  const created = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name: 'Producto Reabrir', price: 100, stock: 5 }),
  });
  assert.equal(created.status, 201);
  const { product } = await created.json();

  const leerStock = async () =>
    Number((await (await fetch(`${baseUrl}/api/products/${product.id}`)).json()).product.stock);

  const crearOrden = async (email) => {
    const r = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: product.id, name: product.name, price: 100, quantity: 5, type: 'product' }],
        customer_name: 'Reabrir',
        customer_email: email,
      }),
    });
    assert.equal(r.status, 201);
    return (await r.json()).order;
  };

  const ordenA = await crearOrden('reabrir-a@e2e.com');
  assert.equal(await leerStock(), 0, 'el pedido se lleva las 5 unidades');

  const cancelada = await fetch(`${baseUrl}/api/orders/${ordenA.id}/status`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ status: 'cancelled' }),
  });
  assert.equal(cancelada.status, 200);
  assert.equal(await leerStock(), 5, 'cancelar las devuelve');

  // Alguien mas se lleva las 5 unidades mientras la orden A estaba cancelada.
  await crearOrden('reabrir-b@e2e.com');
  assert.equal(await leerStock(), 0);

  const reabrir = await fetch(`${baseUrl}/api/orders/${ordenA.id}/status`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(reabrir.status, 409, 'no debe reabrir si no hay stock');
  assert.match((await reabrir.json()).error, /stock suficiente/);

  assert.equal(await leerStock(), 0, 'el stock no debe quedar negativo ni alterado');
  const reread = await (await fetch(`${baseUrl}/api/orders/${ordenA.id}`, { headers: adminHeaders() })).json();
  assert.equal(reread.order.status, 'cancelled', 'la orden debe seguir cancelada (rollback total)');
});

test('persistencia: un COMMIT se ve desde otro proceso', { skip }, async () => {
  const creado = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ name: 'Producto Persistido', price: 555, stock: 1 }),
  });
  assert.equal(creado.status, 201);
  const { product } = await creado.json();

  // Sin sql.js no hay un .db en disco que leer: lo que se verifica es que el
  // COMMIT sea visible desde OTRA conexion, en otro proceso.
  const codigo = `
    const db = require(${JSON.stringify(DB_MODULE)});
    (async () => {
      const row = await db.prepare('SELECT name, price FROM products WHERE id = $1').get(${product.id});
      if (!row) {
        console.error('el producto no llego a la base');
        process.exit(1);
      }
      console.log('otro-proceso-ok:' + row.name + ' ' + row.price);
      await db.close();
    })().catch((error) => { console.error(error); process.exit(1); });
  `;

  const salida = runChild(codigo);
  assert.match(salida, /otro-proceso-ok:Producto Persistido 555/);
});
