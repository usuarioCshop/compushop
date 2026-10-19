const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dbPath = path.join(os.tmpdir(), `compushop-smoke-${process.pid}.db`);
process.env.DB_PATH = dbPath;
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const seedPath = path.join(process.cwd(), 'src', 'db', 'seed.js');
execFileSync(process.execPath, [seedPath], { env: process.env, stdio: 'inherit' });

const db = require('../src/db/database');

test('seed: conteos esperados', async () => {
  await db.init();
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM products').get().c, 12);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM services').get().c, 4);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM categories').get().c, 6);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM settings').get().c, 10);
});

test('isEmpty: detecta una base recien creada sin datos', () => {
  const emptyPath = path.join(os.tmpdir(), `compushop-empty-${process.pid}.db`);
  if (fs.existsSync(emptyPath)) fs.unlinkSync(emptyPath);
  // Otro proceso con su propia DB_PATH: dentro de este proceso el path ya esta fijado.
  const script = `
    const db = require(${JSON.stringify(path.join(process.cwd(), 'src', 'db', 'database.js'))});
    db.init().then(() => {
      if (db.isEmpty() !== true) {
        console.error('isEmpty() debio ser true en una base vacia');
        process.exit(1);
      }
      console.log('base vacia detectada');
    });
  `;
  const out = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, DB_PATH: emptyPath },
    encoding: 'utf8',
  });
  assert.match(out, /base vacia detectada/);
});

test('isEmpty: la base sembrada deja de estar vacia', async () => {
  await db.init();
  assert.equal(db.isEmpty(), false);
  assert.equal(db.isEmpty('services'), false);
});

test('filtro de activos y lookup por id/slug', async () => {
  await db.init();
  const all = db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active = 1').get().c;
  assert.equal(all, 12);
  const byId = db.prepare('SELECT name, slug FROM products WHERE id = ?').get(1);
  assert.equal(byId.slug, 'notebook-lenovo-ideapad-3');
  const bySlug = db.prepare('SELECT id FROM products WHERE slug = ?').get('notebook-lenovo-ideapad-3');
  assert.equal(bySlug.id, 1);
});

test('round-trip de persistencia', async () => {
  await db.init();
  const before = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  const r = db.prepare('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)').run('Smoke', 'smoke@test.com', 'hola');
  assert.ok(r.lastInsertRowid > 0);
  const row = db.prepare('SELECT name, is_read FROM contact_messages WHERE id = ?').get(r.lastInsertRowid);
  assert.equal(row.name, 'Smoke');
  assert.equal(row.is_read, 0);
  db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(r.lastInsertRowid);
  const updated = db.prepare('SELECT is_read FROM contact_messages WHERE id = ?').get(r.lastInsertRowid);
  assert.equal(updated.is_read, 1);
  const after = db.prepare('SELECT COUNT(*) AS c FROM contact_messages').get().c;
  assert.equal(after, before + 1);
});