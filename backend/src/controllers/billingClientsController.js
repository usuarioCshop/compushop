const db = require('../db/database');

function pick(body, key, fallback = null) {
  if (body[key] === undefined) return fallback;
  if (body[key] === '') return null;
  return body[key];
}

// GET /api/billing-clients?search=&limit=
async function getAll(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const take = Math.min(parseInt(req.query.limit) || 30, 100);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR doc_number ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`;
    }
    params.push(take);

    const clients = await db.prepare(`
      SELECT *
      FROM billing_clients
      ${where}
      ORDER BY name ASC, id DESC
      LIMIT $${params.length}
    `).all(...params);

    res.json({ clients });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes de facturación' });
  }
}

// GET /api/billing-clients/sources?search=&type=repair|online
// Importar datos desde repair_clients o usuarios/pedidos online
async function getSources(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const type = (req.query.type || '').trim();
    const take = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = { repair_clients: [], online_clients: [] };
    const params = [];
    let searchWhere = '';
    if (search) {
      params.push(`%${search}%`);
      searchWhere = `AND (name ILIKE $1 OR dni ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)`;
    }

    if (!type || type === 'repair') {
      const p = search ? [params[0], take] : [take];
      const where = search
        ? 'WHERE name ILIKE $1 OR dni ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1'
        : '';
      result.repair_clients = await db.prepare(`
        SELECT id, name, dni AS doc_number, 'DNI' AS doc_type, address, email, phone
        FROM repair_clients
        ${where}
        ORDER BY name ASC
        LIMIT $${p.length}
      `).all(...p);
    }

    if (!type || type === 'online') {
      const p = search ? [params[0], take] : [take];
      const where = search
        ? `WHERE (u.name ILIKE $1 OR u.dni ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1 OR o.customer_name ILIKE $1 OR o.customer_email ILIKE $1)`
        : '';
      // Usuarios registrados (clientes) y también datos de pedidos online
      result.online_clients = await db.prepare(`
        SELECT
          u.id AS user_id,
          COALESCE(u.name, '') AS name,
          COALESCE(u.dni, '') AS doc_number,
          CASE WHEN u.dni IS NOT NULL AND u.dni <> '' THEN 'DNI' ELSE NULL END AS doc_type,
          COALESCE(u.address, '') AS address,
          COALESCE(u.email, '') AS email,
          COALESCE(u.phone, '') AS phone,
          'user' AS origin
        FROM users u
        ${search ? "WHERE u.role = 'customer' AND (u.name ILIKE $1 OR u.dni ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1)" : "WHERE u.role = 'customer'"}
        UNION
        SELECT
          NULL AS user_id,
          COALESCE(o.customer_name, '') AS name,
          '' AS doc_number,
          NULL AS doc_type,
          COALESCE(o.shipping_address, '') AS address,
          COALESCE(o.customer_email, '') AS email,
          COALESCE(o.customer_phone, '') AS phone,
          'order' AS origin
        FROM orders o
        ${search ? "WHERE o.customer_name ILIKE $1 OR o.customer_email ILIKE $1 OR o.customer_phone ILIKE $1" : "WHERE 1=1"}
        ORDER BY name ASC
        LIMIT $${p.length}
      `).all(...p);
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al buscar fuentes de clientes' });
  }
}

// GET /api/billing-clients/:id
async function getOne(req, res) {
  try {
    const client = await db.prepare('SELECT * FROM billing_clients WHERE id = $1').get(req.params.id);
    if (!client || !client.id) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ client });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
}

// POST /api/billing-clients
async function create(req, res) {
  try {
    const body = req.body;
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    const inserted = await db.prepare(`
      INSERT INTO billing_clients (name, doc_type, doc_number, condicion_iva, address, email, phone, source_type, source_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `).run(
      String(body.name).trim(),
      pick(body, 'doc_type'),
      pick(body, 'doc_number'),
      pick(body, 'condicion_iva'),
      pick(body, 'address'),
      pick(body, 'email'),
      pick(body, 'phone'),
      pick(body, 'source_type'),
      body.source_id ?? null
    );
    res.status(201).json({ client: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cliente de facturación' });
  }
}

// PUT /api/billing-clients/:id
async function update(req, res) {
  try {
    const existing = await db.prepare('SELECT * FROM billing_clients WHERE id = $1').get(req.params.id);
    if (!existing || !existing.id) return res.status(404).json({ error: 'Cliente no encontrado' });
    const body = req.body;
    await db.prepare(`
      UPDATE billing_clients SET
        name = $1, doc_type = $2, doc_number = $3, condicion_iva = $4,
        address = $5, email = $6, phone = $7
      WHERE id = $8
    `).run(
      body.name !== undefined ? String(body.name).trim() : existing.name,
      pick(body, 'doc_type', existing.doc_type),
      pick(body, 'doc_number', existing.doc_number),
      pick(body, 'condicion_iva', existing.condicion_iva),
      pick(body, 'address', existing.address),
      pick(body, 'email', existing.email),
      pick(body, 'phone', existing.phone),
      req.params.id
    );
    const client = await db.prepare('SELECT * FROM billing_clients WHERE id = $1').get(req.params.id);
    res.json({ client });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cliente de facturación' });
  }
}

module.exports = { getAll, getSources, getOne, create, update };
