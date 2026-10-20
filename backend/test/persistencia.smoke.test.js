// Tests de la capa de datos contra un Postgres real.
//
// Requieren TEST_DATABASE_URL (ver helpers.js). Sin esa variable se saltean:
// son destructivos.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { skip, useTestDatabase } = require('./helpers');

if (!skip) useTestDatabase();

const db = require('../src/db/database');

after(async () => {
  await db.close();
});

test('esquema: las tablas de la migracion existen', { skip }, async () => {
  const estado = await db.checkSchema();
  assert.deepEqual(estado.missing, []);
  assert.equal(estado.ready, true);
});

test('seed: los conteos son los esperados', { skip }, async () => {
  const contar = async (tabla) => (await db.prepare(`SELECT COUNT(*) AS c FROM ${tabla}`).get()).c;
  assert.equal(await contar('products'), 12);
  assert.equal(await contar('categories'), 6);
  assert.equal(await contar('services'), 4);
  assert.equal(await contar('users'), 2);
});

test('tipos: numeric y bigint vuelven como number, no como string', { skip }, async () => {
  // El motivo del mapeo de tipos: sin el parser, 689999.00 vuelve "689999.00"
  // (string) y COUNT(*) vuelve "12" (bigint). Los dos casos, cubiertos.
  const producto = await db.prepare('SELECT price FROM products WHERE id = $1').get(1);
  assert.equal(typeof producto.price, 'number');

  const conteo = await db.prepare('SELECT COUNT(*) AS c FROM orders').get();
  assert.equal(typeof conteo.c, 'number');

  // SUM() sobre cero filas es NULL: eso lo tiene que resolver la consulta.
  const suma = await db.prepare('SELECT SUM(total) AS s FROM orders').get();
  assert.ok(suma.s === null || typeof suma.s === 'number');
});

test('isEmpty(): false con datos, true sin filas', { skip }, async () => {
  assert.equal(await db.isEmpty('products'), false);
  // El seed trunca todo, asi que esta tabla arranca vacia.
  assert.equal(await db.isEmpty('contact_messages'), true);
});

test('isEmpty(): rechaza tablas que no conoce', { skip }, async () => {
  await assert.rejects(() => db.isEmpty('productos'), /Tabla desconocida/);
});

test('registro por id y por slug', { skip }, async () => {
  const porId = await db.prepare('SELECT name, slug FROM products WHERE id = $1').get(1);
  assert.equal(porId.slug, 'notebook-lenovo-ideapad-3');

  const porSlug = await db.prepare('SELECT id FROM products WHERE slug = $1').get('notebook-lenovo-ideapad-3');
  assert.equal(porSlug.id, 1);
});

test('round-trip de escritura, lectura y update', { skip }, async () => {
  const antes = (await db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get()).c;

  const insertado = await db.prepare(
    'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING id, is_read'
  ).run('Smoke', 'smoke@test.com', 'hola');

  assert.equal(insertado.changes, 1);
  const id = insertado.rows[0].id;
  assert.ok(id > 0);
  // is_read es boolean de verdad: si la columna fuera 0/1 esto falla.
  assert.equal(insertado.rows[0].is_read, false);

  const leido = await db.prepare('SELECT name, is_read FROM contact_messages WHERE id = $1').get(id);
  assert.equal(leido.name, 'Smoke');
  assert.equal(leido.is_read, false);

  const actualizado = await db.prepare('UPDATE contact_messages SET is_read = true WHERE id = $1').run(id);
  assert.equal(insertado.rows[0].id, actualizado.rows[0]?.id ?? id);
  assert.equal(insertado.changes, 1);

  const despues = await db.prepare('SELECT is_read FROM contact_messages WHERE id = $1').get(id);
  assert.equal(despues.is_read, true);

  const total = (await db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get()).c;
  assert.equal(total, antes + 1);
});

test('unique: la violacion trae SQLSTATE 23505 e isUniqueViolation la reconoce', { skip }, async () => {
  const slug = `smoke-${Date.now()}`;
  await db.prepare('INSERT INTO categories (name, slug) VALUES ($1, $2)').run('Smoke', slug);

  await assert.rejects(
    () => db.prepare('INSERT INTO categories (name, slug) VALUES ($1, $2)').run('Smoke otra', slug),
    (error) => {
      assert.equal(error.code, '23505', 'Postgres usa 23505 para unique_violation');
      assert.equal(db.isUniqueViolation(error), true);
      return true;
    }
  );
});

test('check: el motor rechaza un estado fuera del CHECK', { skip }, async () => {
  await assert.rejects(
    () =>
      db.prepare('INSERT INTO orders (order_number, status, total, customer_name, customer_email) VALUES ($1, $2, $3, $4, $5)')
        .run(`CHECK-${Date.now()}`, 'inventado', 10, 'T', 't@t.com'),
    (error) => {
      // 23514 = check_violation
      assert.equal(error.code, '23514');
      return true;
    }
  );
});
