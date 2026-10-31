require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const db = require('./db/database');
const AppError = require('./utils/AppError');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());

// Orígenes permitidos (local + producción Vercel)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://compushop-dun.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permitir requests sin Origin (curl, healthchecks) y los listados
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin || '')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo más tarde.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados mensajes. Probá de nuevo más tarde.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/contact', contactLimiter);

// Verificar la conexion antes de procesar peticiones. init() esta memoizado: la
// primera llamada valida contra Postgres y las siguientes son un no-op, asi que
// en serverless (donde esto corre en cada cold start) el costo es una sola query.
app.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    // Errores de configuración son seguros para distinguir: no filtran nombres
    // de tablas/columnas ni valores. Los errores de Postgres van al handler
    // genérico para no filtrar información sensible.
    if (msg.includes('Falta DATABASE_URL')) {
      console.error('❌ Configuración incompleta:', msg);
      return res
        .status(500)
        .json({ error: 'Base de datos no configurada. Falta DATABASE_URL en las variables de entorno.' });
    }
    next(err);
  }
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ name: 'Compushop API', version: '1.0.0', status: 'ok' });
});

app.use((err, req, res, next) => {
  logger.error('request_error', { message: err.message, stack: err.stack });
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.status && err.message && !err.message.includes('CORS')) {
    return res.status(err.status).json({ error: err.message });
  }

  res.status(500).json({ error: 'Error interno del servidor' });
});

// Diagnostico de arranque. Con sql.js el esquema se creaba solo al abrir la app;
// ahora hay dos pasos explicitos (npm run migrate, npm run seed) y los dos
// errores mas probables al levantar el server merecen un mensaje claro en vez de
// un 500 en la primera consulta.
async function startupDiagnostics() {
  const schema = await db.checkSchema();
  if (!schema.ready) {
    console.warn(`⚠️  Faltan tablas en ${db.describeConnection()}: ${schema.missing.join(', ')}`);
    console.warn('   Ejecutá "npm run migrate".');
    return;
  }
  if (await db.isEmpty()) {
    console.warn(`⚠️  La base ${db.describeConnection()} no tiene datos. Ejecutá "npm run seed".`);
  }
}

// Vercel serverless: exportar app; local: listen
if (process.env.VERCEL) {
  // En serverless no hay arranque: el modulo se evalua en cada cold start.
  startupDiagnostics().catch((err) =>
    console.error('Diagnóstico de arranque falló:', err.message)
  );
  module.exports = app;
} else {
  db.init()
    .then(async () => {
      await startupDiagnostics();
      app.listen(PORT, '127.0.0.1', () => {
        console.log(`🚀 Compushop API corriendo en http://127.0.0.1:${PORT}`);
        console.log(`   Base: ${db.describeConnection()}`);
      });
    })
    .catch((err) => {
      console.error('Error inicializando la base:', err.message);
      process.exit(1);
    });
  module.exports = app;
}
