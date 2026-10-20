// Runner de migraciones. Aplica en orden los .sql de src/db/migrations que
// todavia no figuren en la tabla schema_migrations, cada uno dentro de su propia
// transaccion: o entra completo, o no entra.
//
//   npm run migrate          aplica lo pendiente
//   npm run migrate:status   solo muestra el estado
//
// La aplicacion NO crea el esquema al arrancar: eso era necesario con sql.js en
// el filesystem efimero de Vercel, pero en un Postgres real correr DDL en cada
// arranque es una fuente de carreras. El esquema se aplica una vez, aca.
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// Las migraciones y el seed van por la conexion DIRECTA (sin -pooler): el pooler
// de Neon trabaja en modo transaccion y no aporta nada a una sesion de un solo
// uso. Neon publica esa cadena como DATABASE_URL_UNPOOLED; la app, en cambio,
// usa DATABASE_URL (pooled).
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const db = require('./database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function appliedVersions() {
  const result = await db.query('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((row) => row.version));
}

// Aplica lo pendiente. Devuelve los nombres aplicados en esta corrida.
async function migrate({ log } = {}) {
  const logLine = log || (() => {});
  await db.init();
  await ensureMigrationsTable();

  const applied = await appliedVersions();
  const pending = migrationFiles().filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // En Postgres el DDL es transaccional: si algo falla a mitad de camino, la
    // base queda como estaba y la migracion se reintenta completa.
    await db.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
    logLine(`aplicada: ${file}`);
  }

  return pending;
}

async function status() {
  await db.init();
  await ensureMigrationsTable();
  const applied = await appliedVersions();
  return migrationFiles().map((file) => ({ file, applied: applied.has(file) }));
}

async function main() {
  const onlyStatus = process.argv.includes('--status');
  try {
    console.log(`Base: ${db.describeConnection()}`);

    if (onlyStatus) {
      const rows = await status();
      for (const row of rows) {
        console.log(`  ${row.applied ? '✔ aplicada ' : '· pendiente'} ${row.file}`);
      }
      return;
    }

    const appliedNow = await migrate({ log: (line) => console.log(`  ${line}`) });
    console.log(
      appliedNow.length
        ? `Migraciones aplicadas: ${appliedNow.length}`
        : 'Sin migraciones pendientes.'
    );
  } catch (error) {
    console.error('Migración falló:', error.message);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrate, status, ensureMigrationsTable };
