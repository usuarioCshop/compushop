const fs = require('fs');
const path = require('path');

function resolveDbPath() {
  const raw = process.env.DB_PATH || './src/db/compushop.db';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

const DB_PATH = resolveDbPath();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  dni TEXT,
  role TEXT DEFAULT 'customer',
  phone TEXT,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  category_id INTEGER,
  brand TEXT,
  image TEXT,
  specs TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL,
  duration TEXT,
  image TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  total REAL NOT NULL,
  shipping_address TEXT,
  notes TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  service_id INTEGER,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

let SQL;
let database;
let initPromise;

function persist() {
  if (!database) return;
  const data = database.export();
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs({
      locateFile: (file) => path.join(path.dirname(require.resolve('sql.js')), file),
    });
    const dir = path.dirname(DB_PATH);
    fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      database = new SQL.Database(buffer);
    } else {
      database = new SQL.Database();
    }

    database.run(SCHEMA);
    if (!fs.existsSync(DB_PATH)) {
      persist();
    }
    return database;
  })();
  initPromise = initPromise.catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

function getDb() {
  if (!database) {
    throw new Error('Base de datos no inicializada. Ejecutar db.init() antes de usarla.');
  }
  return database;
}

function lastInsertRowid() {
  const result = getDb().exec('SELECT last_insert_rowid() AS id');
  if (!result.length || !result[0].values.length) return undefined;
  return result[0].values[0][0];
}

function createStatement(sql) {
  return {
    run(...params) {
      const db = getDb();
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = db.prepare(sql);
      try {
        if (flat.length) stmt.bind(flat);
        stmt.step();
      } finally {
        stmt.free();
      }
      const changes = db.getRowsModified();
      const rid = lastInsertRowid();
      persist();
      return { changes, lastInsertRowid: rid };
    },
    get(...params) {
      const db = getDb();
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = db.prepare(sql);
      let row = null;
      try {
        if (flat.length) stmt.bind(flat);
        if (stmt.step()) row = stmt.getAsObject();
      } finally {
        stmt.free();
      }
      return row;
    },
    all(...params) {
      const db = getDb();
      const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const stmt = db.prepare(sql);
      const rows = [];
      try {
        if (flat.length) stmt.bind(flat);
        while (stmt.step()) rows.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return rows;
    },
  };
}

function transaction(fn) {
  return () => {
    const db = getDb();
    db.run('BEGIN');
    try {
      const result = fn();
      db.run('COMMIT');
      persist();
      return result;
    } catch (error) {
      try {
        db.run('ROLLBACK');
      } catch (_) {}
      throw error;
    }
  };
}

const api = {
  init,
  get: getDb,
  prepare: (sql) => createStatement(sql),
  exec: (sql, params = []) => {
    const db = getDb();
    if (params && params.length) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(Array.isArray(params) ? params : [params]);
        stmt.step();
      } finally {
        stmt.free();
      }
    } else {
      db.run(sql);
    }
    persist();
  },
  transaction,
  persist,
  DB_PATH,
};

module.exports = api;