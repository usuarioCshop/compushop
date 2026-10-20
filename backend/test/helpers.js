// Helpers compartidos por los tests que tocan la base.
//
// Los tests son DESTRUCTIVOS: migran, hacen TRUNCATE ... RESTART IDENTITY y
// vuelven a sembrar. Por eso NO miran DATABASE_URL (la base de la app) sino
// TEST_DATABASE_URL, y si esa variable no esta, se saltean con un aviso en
// lugar de correr. Un test que se saltea se ve; un test que borra la base
// equivocada, no.
//
// Antes esto usaba sql.js con un archivo temporal por test (DB_PATH). En
// Postgres un archivo temporal no existe: "la base de test" es una base real,
// y crearla es una decision de quien corre los tests (una branch de Neon, por
// ejemplo). El test solo la usa.
const path = require('node:path');
const { execFileSync } = require('node:child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BACKEND = path.join(__dirname, '..');
const DB_MODULE = path.join(BACKEND, 'src', 'db', 'database.js');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// false, o el motivo por el que se saltean. El segundo caso le importa a quien
// lee la salida: "skipped" sin explicacion parece un test roto.
// RUIDO: una suite que se saltea entera y sale con codigo 0 es un falso verde
// identico a una suite que pasa. Esto ya paso una vez (22 tests, 0 ejecutados)
// y nadie se dio cuenta hasta que alguien los corro a mano. Por eso en CI falla
// de entrada, y en local imprime un aviso que no se puede pasar por alto.
const isCI = process.env.CI === 'true' || process.env.CI === '1' || !!process.env.GITHUB_ACTIONS;

if (!TEST_DATABASE_URL && isCI) {
  throw new Error(
    'TEST_DATABASE_URL no esta definida y esto es CI: la suite se saltaria TODOS los tests ' +
    'y reportaria verde sin ejecutar nada. Configura TEST_DATABASE_URL como secret del pipeline.'
  );
}

const skip = TEST_DATABASE_URL
  ? false
  : 'Falta TEST_DATABASE_URL en backend/.env (estos tests son destructivos y no tocan la base de la app)';

if (skip) {
  process.emitWarning(
    '\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n' +
    '  SUITE DE BASE DE DATOS COMPLETAMENTE SALTEADA\n' +
    '  Se ejecutaran 0 tests y el proceso saldra con codigo 0.\n' +
    '  Esto NO es un verde: es un falso verde.\n' +
    '  Motivo: ' + skip + '\n' +
    '  Fix: definir TEST_DATABASE_URL en backend/.env\n' +
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n',
    'TestDatabaseSkipped'
  );
}

// Deja la base de test lista: migrada y sembrada. Se llama una sola vez, al
// cargar el archivo.
function useTestDatabase() {
  if (!TEST_DATABASE_URL) {
    throw new Error('useTestDatabase() se llamo sin TEST_DATABASE_URL: hay que saltear con { skip }');
  }

  process.env.DATABASE_URL = TEST_DATABASE_URL;

  // La trampa que hay que desactivar a mano: migrate.js y seed.js prefieren
  // DATABASE_URL_UNPOOLED (que en .env apunta a la base REAL) y ademas cargan
  // dotenv. Borrar la variable NO alcanza: dotenv la vuelve a leer del archivo
  // y el script termina migrando y sembrando produccion mientras el test cree
  // estar en la base de test. La unica forma segura es pisarla con la misma URL
  // de test antes de invocar a los hijos.
  process.env.DATABASE_URL_UNPOOLED = TEST_DATABASE_URL;

  const env = { ...process.env };
  for (const script of ['migrate.js', 'seed.js']) {
    execFileSync(process.execPath, [path.join(BACKEND, 'src', 'db', script)], { env, stdio: 'inherit' });
  }
}

// Corre un script de node con el entorno de base del test. Sirve para verificar
// que un COMMIT se ve desde OTRO proceso y no solo desde el pool de este.
function runChild(code) {
  return execFileSync(process.execPath, ['-e', code], { env: { ...process.env }, encoding: 'utf8' });
}

module.exports = { skip, useTestDatabase, runChild, DB_MODULE, BACKEND };
