const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dbPath = path.join(os.tmpdir(), `compushop-tx-${process.pid}.db`);
process.env.DB_PATH = dbPath;
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const seedPath = path.join(process.cwd(), 'src', 'db', 'seed.js');
execFileSync(process.execPath, [seedPath], { env: process.env, stdio: 'inherit' });

const db = require('../src/db/database');

test('transaccion: multiples escrituras dentro de transaction() no fallan en COMMIT', async () => {
  await db.init();
  const insertOrder = db.prepare(
    'INSERT INTO orders (order_number, status, total, customer_name, customer_email) VALUES (?, ?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, service_id, name, price, quantity, type) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

  // Replica el patron del controlador de pedidos: varias escrituras en una transaccion
  const fn = db.transaction(() => {
    const order = insertOrder.run(`TEST-${Date.now()}`, 'confirmed', 100, 'T', 't@t.com');
    const orderId = order.lastInsertRowid;
    insertItem.run(orderId, 1, null, 'Producto', 100, 1, 'product');
    const info = updateStock.run(1, 1, 1);
    if (info.changes === 0) throw new Error('Stock insuficiente');
    return orderId;
  });

  const orderId = fn();
  assert.ok(orderId > 0, 'la transaccion debe devolver el id insertado');
  const total = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  assert.ok(total >= 1);
});

test('transaccion: si algo falla, se hace rollback y no queda a medias', async () => {
  await db.init();
  const before = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const fn = db.transaction(() => {
    db.prepare(
      'INSERT INTO orders (order_number, status, total, customer_name, customer_email) VALUES (?, ?, ?, ?, ?)'
    ).run(`RB-${Date.now()}`, 'confirmed', 1, 'T', 't@t.com');
    throw new Error('falla deliberada');
  });

  assert.throws(() => fn(), /falla deliberada/);
  const after = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  assert.equal(after, before, 'el rollback debe dejar la base como estaba');
});

test('transaccion: lo escrito dentro de la transaccion llega al archivo', () => {
  const script = `
    const db = require(${JSON.stringify(path.join(process.cwd(), 'src', 'db', 'database.js'))});
    db.init().then(() => {
      const r = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE 'TEST-%'").get();
      if (r.c < 1) {
        console.error('el pedido de la transaccion no esta en el archivo');
        process.exit(1);
      }
      console.log('archivo ok');
    });
  `;
  const out = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf8',
  });
  assert.match(out, /archivo ok/);
});
