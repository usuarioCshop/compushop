const db = require('../db/database');

// GET /api/repair-clients?search=  (solo tecnico/admin)
// Busca por nombre, DNI, email o telefono. Sin search devuelve los ultimos clientes.
async function getAll(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const take = Math.min(parseInt(req.query.limit) || 20, 50);

    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = 'WHERE name ILIKE $1 OR dni ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
    }
    params.push(take);

    const clients = await db.prepare(`
      SELECT id, name, address, dni, email, phone, created_at, updated_at
      FROM repair_clients
      ${where}
      ORDER BY name ASC
      LIMIT $${params.length}
    `).all(...params);

    res.json({ clients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
}

// POST /api/repair-clients  (solo tecnico/admin)
async function create(req, res) {
  try {
    const { name, address, dni, email, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }

    const inserted = await db.prepare(`
      INSERT INTO repair_clients (name, address, dni, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, address, dni, email, phone, created_at, updated_at
    `).run(name.trim(), address || null, dni || null, email || null, phone || null);

    res.status(201).json({ message: 'Cliente guardado', client: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el cliente' });
  }
}

module.exports = { getAll, create };
