// Tests de transaction(): es el patron que usa el controlador de pedidos.
//
// Requieren TEST_DATABASE_URL (ver helpers.js). Sin esa variable se saltean.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { skip, useTestDatabase, runChild, DB_MODULE } = require('./helpers');

if (!skip) useTestDatabase();

const db = require('../src/db/database');

after(async () => {
  await db.close();
});

const contarOrdenes = async () => (await db.prepare('SELECT COUNT(*) AS c FROM orders').get()).c;
const stockDe = async () => (await db.prepare('SELECT stock FROM products WHERE id = $1').get(1)).stock;

test('transaction(): varias escrituras commitean juntas', { skip }, async () => {
  const ordenesAntes = await contarOrdenes();
  const stockAntes = await stockDe();

  const orderId = await db.transaction(async (tx) => {
    const orden = await tx.prepare(`
      INSERT INTO orders (order_number, status, total, customer_name, customer_email)
      VALUES ($1, 'confirmed', 100, 'Prueba', 't@t.com')
      RETURNING id
    `).run(`TX-${Date.now()}`);
    const id = orden.rows[0].id;

    await tx.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, quantity, type)
      VALUES ($1, 1, 'Producto', 100, 1, 'product')
    `).run(id);

    const info = await tx.prepare('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3').run(1, 1, 1);
    assert.equal(info.changes, 1, 'el update de stock tiene que afectar una fila');

    return id;
  });

  assert.ok(orderId > 0);
  assert.equal(await contarOrdenes(), ordenesAntes + 1);

  const items = await db.prepare('SELECT COUNT(*) AS c FROM order_items WHERE order_id = $1').get(orderId);
  assert.equal(items.c, 1, 'el item quedo asociado al pedido');
  assert.equal(await stockDe(), stockAntes - 1);
});

test('transaction(): si el callback tira, no queda NADA a medio escribir', { skip }, async () => {
  const ordenesAntes = await contarOrdenes();
  const stockAntes = await stockDe();

  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        const orden = await tx.prepare(`
          INSERT INTO orders (order_number, status, total, customer_name, customer_email)
          VALUES ($1, 'confirmed', 10, 'Prueba', 't@t.com')
          RETURNING id
        `).run(`ROLLBACK-${Date.now()}`);
        const id = orden.rows[0].id;

        await tx.prepare(`
          INSERT INTO order_items (order_id, product_id, name, price, quantity, type)
          VALUES ($1, 1, 'Producto', 10, 1, 'product')
        `).run(id);

        await tx.prepare('UPDATE products SET stock = stock - $1 WHERE id = $2').run(1, 1);

        throw new Error('corte a proposito');
      }),
    /corte a proposito/
  );

  assert.equal(await contarOrdenes(), ordenesAntes, 'la orden no puede quedar');
  assert.equal(await stockDe(), stockAntes, 'el stock no puede cambiar');

  const ordenesSueltas = await db.prepare("SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE $1").get('ROLLBACK-%');
  assert.equal(ordenesSueltas.c, 0, 'no puede quedar la orden del rollback');

  const itemsSueltos = await db.prepare(`
    SELECT COUNT(*) AS c FROM order_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.order_number LIKE $1
  `).get('ROLLBACK-%');
  assert.equal(itemsSueltos.c, 0, 'no pueden quedar items huerfanos');
});

test('transaction(): un update que no afecta filas aborta el pedido', { skip }, async () => {
  const ordenesAntes = await contarOrdenes();
  const stockAntes = await stockDe();

  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        const orden = await tx.prepare(`
          INSERT INTO orders (order_number, status, total, customer_name, customer_email)
          VALUES ($1, 'confirmed', 10, 'Prueba', 't@t.com')
          RETURNING id
        `).run(`SIN-STOCK-${Date.now()}`);
        await tx.prepare(`
          INSERT INTO order_items (order_id, product_id, name, price, quantity, type)
          VALUES ($1, 1, 'Producto', 10, 1, 'product')
        `).run(orden.rows[0].id);

        // Pide mas stock del que hay: el UPDATE no afecta ninguna fila.
        const info = await tx
          .prepare('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3')
          .run(stockAntes + 1, 1, stockAntes + 1);

        assert.equal(info.changes, 0, 'no puede descontar mas stock del que hay');
        throw new Error('Stock insuficiente para: Producto');
      }),
    /Stock insuficiente/
  );

  assert.equal(await contarOrdenes(), ordenesAntes);
  assert.equal(await stockDe(), stockAntes);
});

test('un COMMIT se ve desde otro proceso', { skip }, async () => {
  const nombre = `Producto de otro proceso ${Date.now()}`;

  await db.transaction(async (tx) => {
    await tx.prepare('INSERT INTO products (name, slug, price, stock) VALUES ($1, $2, $3, $4)').run(
      nombre,
      `otro-proceso-${Date.now()}`,
      123,
      1
    );
  });

  // Sin sql.js no hay "archivo de la base": lo que se puede verificar es que la
  // escritura sea visible desde OTRA conexion, en otro proceso.
  const codigo = `
    const db = require(${JSON.stringify(DB_MODULE)});
    (async () => {
      const row = await db.prepare('SELECT name FROM products WHERE name = $1').get(${JSON.stringify(nombre)});
      if (!row) {
        console.error('el producto no llego a la base');
        process.exit(1);
      }
      console.log('otro-proceso-ok:' + row.name);
      await db.close();
    })().catch((error) => { console.error(error); process.exit(1); });
  `;

  const salida = runChild(codigo);
  assert.match(salida, /otro-proceso-ok:/);
});
