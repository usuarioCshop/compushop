const db = require('../db/database');

// GET /api/settings (admin/public según uso, pero protegido con admin en rutas)
async function getAll(req, res) {
  try {
    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
}

// PUT /api/settings (admin)
async function update(req, res) {
  try {
    const data = req.body;
    const allowed = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'contact_to',
      'store_name', 'store_phone', 'store_address', 'store_email',
      'usd_rate',
      'iibb_percent',
    ];

    // Dentro de la transaccion se usa siempre el runner que entrega el callback
    // (tx), nunca db.prepare: ese ultimo saldria del pool y partiria la
    // transaccion en dos conexiones.
    await db.transaction(async (tx) => {
      const upsert = tx.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      for (const key of allowed) {
        if (data[key] !== undefined) {
          await upsert.run(key, String(data[key]));
        }
      }
    });

    const rows = await db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    res.json({ message: 'Configuración actualizada', settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
}

module.exports = { getAll, update };
