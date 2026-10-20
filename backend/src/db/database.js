// Capa unica de persistencia: Postgres, via el driver pg.
//
// La forma de la API es la misma que tenia sql.js (prepare() -> run/get/all),
// pero ahora es ASINCRONA: cada operacion devuelve una promesa.
//
// Dentro de una transaccion hay que usar SIEMPRE el runner que entrega
// transaction(), nunca db.prepare(): este ultimo sale del pool y tomaria otra
// conexion, con lo cual la transaccion quedaria partida en dos.
const { Pool, types } = require('pg');

// ---------------------------------------------------------------------------
// Mapeo de tipos
// ---------------------------------------------------------------------------
// node-postgres devuelve numeric y bigint como STRING, para no perder precision
// (un decimal de 40 digitos no entra en un number de JS). La API de Compushop
// siempre devolvio numeros, asi que restauramos ese contrato una sola vez aca,
// en la capa de datos, en lugar de convertir en cada controller.
//   1700 = numeric -> precios, totales, SUM()
//     20 = int8    -> COUNT(), ids internos de Postgres
// En este dominio (precios y conteos de una casa de computacion) no existen
// valores que no entren con seguridad en un number.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

// Tablas del esquema. Evita interpolar cualquier string como nombre de tabla.
const KNOWN_TABLES = [
  'users',
  'categories',
  'products',
  'services',
  'orders',
  'order_items',
  'contact_messages',
  'settings',
  'password_resets',
];

let pool = null;
let initPromise = null;

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Pegá la cadena de conexión de Neon en backend/.env (ver .env.example).'
    );
  }
  return url;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString(),
      // Neon exige TLS y su certificado lo firma una CA publica, asi que por
      // defecto lo verificamos. PG_SSL_NO_VERIFY=true lo relaja para entornos
      // donde el bundle de CA de Node no lo reconoce; PGSSL=disable lo apaga
      // (util contra un Postgres local sin TLS).
      ssl:
        process.env.PGSSL === 'disable'
          ? false
          : { rejectUnauthorized: process.env.PG_SSL_NO_VERIFY !== 'true' },
      // Serverless (Vercel): cada invocacion mantiene su propia instancia del
      // modulo y hay decenas en paralelo, asi que el pool va chico; del otro
      // lado, el pooler de Neon multiplexa las conexiones reales.
      max: Number(process.env.PGPOOL_MAX || 1),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      // Permite que el proceso termine solo cuando no queda trabajo pendiente.
      allowExitOnIdle: true,
    });
    // Sin este handler, un error en una conexion ociosa del pool tumba el proceso.
    pool.on('error', (error) => {
      console.error('Error en una conexión ociosa del pool:', error.message);
    });
  }
  return pool;
}

// Compatibilidad con la API vieja: run(1, 2) y run([1, 2]) hacian lo mismo.
function normalizeParams(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

// Envuelve un ejecutor (el pool, o una conexion tomada para una transaccion) con
// la API que esperan los controllers.
function createRunner(execute) {
  return {
    prepare(sql) {
      return {
        async run(...params) {
          const result = await execute(sql, normalizeParams(params));
          // `changes` conserva el nombre que tenia en sql.js (filas afectadas);
          // `rows` trae lo que devuelva un RETURNING.
          return { changes: result.rowCount, rows: result.rows };
        },
        async get(...params) {
          return (await execute(sql, normalizeParams(params))).rows[0];
        },
        async all(...params) {
          return (await execute(sql, normalizeParams(params))).rows;
        },
      };
    },
    query: (sql, params = []) => execute(sql, params),
  };
}

const poolRunner = createRunner((sql, params) => getPool().query(sql, params));

// Memoizado: la primera llamada verifica conectividad, las siguientes son un
// no-op. Si falla, se libera para permitir el reintento.
async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await poolRunner.query('SELECT 1');
    return true;
  })();
  initPromise = initPromise.catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function missingTables() {
  const result = await poolRunner.query(
    `SELECT t.name
       FROM unnest($1::text[]) AS t (name)
      WHERE to_regclass('public.' || t.name) IS NULL`,
    [KNOWN_TABLES]
  );
  return result.rows.map((row) => row.name);
}

// Postgres: 23505 = unique_violation. Los controllers lo usan para responder 409
// en lugar de un 500 generico.
function isUniqueViolation(error) {
  return Boolean(error) && (error.code === '23505' || /UNIQUE/i.test(error.message || ''));
}

// true cuando la tabla no tiene filas: base recien migrada, falta correr el seed.
async function isEmpty(table = 'products') {
  if (!KNOWN_TABLES.includes(table)) {
    throw new Error(`Tabla desconocida: ${table}`);
  }
  const row = await poolRunner.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return !row || row.c === 0;
}

// Host y base, sin usuario ni contrasena: se puede loguear sin filtrar secretos.
function describeConnection() {
  try {
    const url = new URL(connectionString());
    return `${url.hostname}${url.pathname}`;
  } catch (_) {
    return '(DATABASE_URL no configurada)';
  }
}

async function checkSchema() {
  const missing = await missingTables();
  return { ready: missing.length === 0, missing };
}

// Ejecuta fn dentro de una transaccion. El callback recibe el runner atado a esa
// conexion; todo lo que se ejecute con el participa del COMMIT/ROLLBACK.
async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(createRunner((sql, params) => client.query(sql, params)));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Si el ROLLBACK falla, el error original es el que importa.
    }
    throw error;
  } finally {
    client.release();
  }
}

// Cierra el pool. Necesario en scripts y tests: si queda una conexion abierta el
// proceso no termina.
async function close() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  initPromise = null;
  await closing.end();
}

module.exports = {
  init,
  close,
  checkSchema,
  isEmpty,
  describeConnection,
  isUniqueViolation,
  missingTables,
  prepare: (sql) => poolRunner.prepare(sql),
  query: (sql, params = []) => poolRunner.query(sql, params),
  transaction,
  KNOWN_TABLES,
};
