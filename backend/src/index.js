require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 4000;

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

// Inicializar DB (sql.js) antes de procesar peticiones
app.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ name: 'Compushop API', version: '1.0.0', status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

// Vercel serverless: exportar app; local: listen
if (process.env.VERCEL) {
  module.exports = app;
} else {
  db.init()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Compushop API corriendo en http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Error inicializando DB:', err);
      process.exit(1);
    });
  module.exports = app;
}
