const db = require('../db/database');

// Genera un numero de boleta unico tipo CSYYMMDD-####.
function generateTicketNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CS${y}${m}${d}-${rand}`;
}

// GET /api/technical-repairs  (solo tecnico/admin)
async function getAll(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const take = parseInt(limit);
    const pageNum = parseInt(page);
    const offset = (pageNum - 1) * take;

    const conditions = ['1=1'];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(ticket_number ILIKE $${params.length} OR client_name ILIKE $${params.length} OR article ILIKE $${params.length} OR client_id ILIKE $${params.length})`
      );
    }

    const from = `
      FROM technical_repairs
      WHERE ${conditions.join(' AND ')}
    `;

    const { total } = await db.prepare(`SELECT COUNT(*) as total ${from}`).get(...params);

    params.push(take, offset);
    const repairs = await db.prepare(`
      SELECT *
      ${from}
      ORDER BY received_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `).all(...params);

    res.json({
      repairs,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reparaciones' });
  }
}

// POST /api/technical-repairs  (solo tecnico/admin)
async function create(req, res) {
  try {
    const {
      ticket_number,
      status,
      client_name,
      client_address,
      client_id,
      client_email,
      client_phone,
      article,
      brand,
      model,
      serial_number,
      damage_reported,
      notes,
      image_url,
      probable_repair_date,
    } = req.body;

    if (!client_name || !damage_reported) {
      return res.status(400).json({ error: 'Nombre del cliente y daño reportado son obligatorios' });
    }

    const allowedStatus = ['pendiente', 'en_proceso', 'reparado', 'entregado', 'cancelado'];
    const repairStatus = status && allowedStatus.includes(status) ? status : 'pendiente';

    const inserted = await db.prepare(`
      INSERT INTO technical_repairs (
        ticket_number, status, client_name, client_address, client_id, client_email, client_phone,
        article, brand, model, serial_number, damage_reported, notes, image_url, probable_repair_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `).run(
      ticket_number || generateTicketNumber(),
      repairStatus,
      client_name,
      client_address || null,
      client_id || null,
      client_email || null,
      client_phone || null,
      article || null,
      brand || null,
      model || null,
      serial_number || null,
      damage_reported,
      notes || null,
      image_url || null,
      probable_repair_date || null
    );

    res.status(201).json({ message: 'Orden de reparación creada', repair: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la orden de reparación' });
  }
}

// GET /api/technical-repairs/:id  (solo tecnico/admin)
async function getOne(req, res) {
  try {
    const { id } = req.params;
    const repair = await db.prepare('SELECT * FROM technical_repairs WHERE id = $1').get(id);

    if (!repair) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    res.json({ repair });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la orden de reparación' });
  }
}

// PUT /api/technical-repairs/:id  (solo tecnico/admin)
async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM technical_repairs WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    const {
      ticket_number = existing.ticket_number,
      status = existing.status,
      client_name = existing.client_name,
      client_address = existing.client_address,
      client_id = existing.client_id,
      client_email = existing.client_email,
      client_phone = existing.client_phone,
      article = existing.article,
      brand = existing.brand,
      model = existing.model,
      serial_number = existing.serial_number,
      damage_reported = existing.damage_reported,
      notes = existing.notes,
      image_url = existing.image_url,
      probable_repair_date = existing.probable_repair_date,
    } = req.body;

    const allowedStatus = ['pendiente', 'en_proceso', 'reparado', 'entregado', 'cancelado'];
    const repairStatus = allowedStatus.includes(status) ? status : existing.status;

    const updated = await db.prepare(`
      UPDATE technical_repairs SET
        ticket_number = $1, status = $2, client_name = $3, client_address = $4, client_id = $5,
        client_email = $6, client_phone = $7, article = $8, brand = $9, model = $10,
        serial_number = $11, damage_reported = $12, notes = $13, image_url = $14,
        probable_repair_date = $15
      WHERE id = $16
      RETURNING *
    `).run(
      ticket_number, repairStatus, client_name, client_address, client_id,
      client_email, client_phone, article, brand, model, serial_number,
      damage_reported, notes, image_url, probable_repair_date, id
    );

    res.json({ message: 'Orden de reparación actualizada', repair: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la orden de reparación' });
  }
}

// DELETE /api/technical-repairs/:id  (solo tecnico/admin)
async function remove(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM technical_repairs WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    await db.prepare('DELETE FROM technical_repairs WHERE id = $1').run(id);
    res.json({ message: 'Orden de reparación eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la orden de reparación' });
  }
}

module.exports = { getAll, create, getOne, update, remove };
