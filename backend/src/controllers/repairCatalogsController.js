const db = require('../db/database');

const VALID_TYPES = ['article', 'brand', 'status'];

// GET /api/repair-catalogs/:type  (solo tecnico/admin)
async function getAll(req, res) {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de catálogo inválido. Usá article, brand o status.' });
    }

    const items = await db.prepare(
      'SELECT id, type, name, is_active FROM repair_catalog_items WHERE type = $1 AND is_active = true ORDER BY name ASC'
    ).all(type);

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
}

// POST /api/repair-catalogs/:type  (solo tecnico/admin)
async function create(req, res) {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Tipo de catálogo inválido. Usá article, brand o status.' });
    }

    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const existing = await db.prepare(
      'SELECT id FROM repair_catalog_items WHERE type = $1 AND lower(name) = lower($2)'
    ).get(type, name);
    if (existing && existing.id) {
      return res.status(409).json({ error: 'Ese ítem ya existe en el catálogo' });
    }

    const inserted = await db.prepare(
      'INSERT INTO repair_catalog_items (type, name) VALUES ($1, $2) RETURNING id, type, name, is_active'
    ).run(type, name);

    res.status(201).json({ message: 'Ítem agregado al catálogo', item: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar el ítem al catálogo' });
  }
}

module.exports = { getAll, create };
