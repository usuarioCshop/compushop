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

// Toma un campo opcional del body: si no vino usa el valor actual y si vino
// vacio lo guarda como null.
function pick(body, key, fallback) {
  if (body[key] === undefined) return fallback;
  if (body[key] === '') return null;
  return body[key];
}

// Verifica que el estado exista y este activo en el catalogo.
async function statusExists(status) {
  const row = await db.prepare(
    "SELECT id FROM repair_catalog_items WHERE type = 'status' AND name = $1 AND is_active = true"
  ).get(status);
  return Boolean(row && row.id);
}

// Verifica que el usuario asignado exista y pueda tomar reparaciones.
async function technicianExists(id) {
  const row = await db.prepare(
    "SELECT id FROM users WHERE id = $1 AND role IN ('tecnico', 'admin')"
  ).get(id);
  return Boolean(row && row.id);
}

// GET /api/technical-repairs/next-ticket  (solo tecnico/admin)
// Devuelve el proximo numero de boleta del dia, con formato CSYYMMDD-####.
async function getNextTicket(req, res) {
  try {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `CS${y}${m}${d}-`;

    const last = await db.prepare(
      'SELECT ticket_number FROM technical_repairs WHERE ticket_number LIKE $1 ORDER BY ticket_number DESC LIMIT 1'
    ).get(`${prefix}%`);

    let seq = 1;
    if (last && last.ticket_number) {
      const parsed = parseInt(last.ticket_number.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }

    res.json({ ticket_number: `${prefix}${String(seq).padStart(4, '0')}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el próximo número de boleta' });
  }
}

// GET /api/technical-repairs/technicians  (solo tecnico/admin)
// Usuarios que pueden quedar asignados a una reparacion.
async function getTechnicians(req, res) {
  try {
    const technicians = await db.prepare(
      "SELECT id, name, email, role FROM users WHERE role IN ('tecnico', 'admin') ORDER BY name ASC"
    ).all();

    res.json({ technicians });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los técnicos' });
  }
}

// Arma el WHERE y el ORDER BY compartidos por el listado y el export.
function buildFilters(query) {
  const {
    status,
    search,
    received_from,
    received_to,
    probable_from,
    probable_to,
    sort_by,
    sort_dir,
  } = query;

  const conditions = ['1=1'];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(t.ticket_number ILIKE $${params.length} OR t.client_name ILIKE $${params.length} OR t.article ILIKE $${params.length} OR t.client_id ILIKE $${params.length})`
    );
  }

  if (received_from) {
    params.push(received_from);
    conditions.push(`t.received_at >= $${params.length}::date`);
  }

  if (received_to) {
    params.push(received_to);
    conditions.push(`t.received_at < ($${params.length}::date + interval '1 day')`);
  }

  if (probable_from) {
    params.push(probable_from);
    conditions.push(`t.probable_repair_date >= $${params.length}::date`);
  }

  if (probable_to) {
    params.push(probable_to);
    conditions.push(`t.probable_repair_date <= $${params.length}::date`);
  }

  const sortColumns = {
    ticket_number: 't.ticket_number',
    client_name: 't.client_name',
    article: 't.article',
    brand: 't.brand',
    status: 't.status',
    received_at: 't.received_at',
    probable_repair_date: 't.probable_repair_date',
    assigned_to: 'u.name',
  };

  return {
    where: `WHERE ${conditions.join(' AND ')}`,
    params,
    sortColumn: sortColumns[sort_by] || 't.received_at',
    sortDirection: sort_dir === 'asc' ? 'ASC' : 'DESC',
  };
}

// GET /api/technical-repairs  (solo tecnico/admin)
async function getAll(req, res) {
  try {
    const { page, limit } = req.query;
    const take = limit;
    const pageNum = page;
    const offset = (pageNum - 1) * take;

    const { where, params, sortColumn, sortDirection } = buildFilters(req.query);

    const { total } = await db.prepare(
      `SELECT COUNT(*)::int AS total FROM technical_repairs t ${where}`
    ).get(...params);

    params.push(take, offset);
    const repairs = await db.prepare(`
      SELECT t.*, u.name AS assigned_to_name
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      ${where}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, t.id DESC
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

// Escapa una celda de CSV y evita que Excel interprete formulas.
function csvCell(value) {
  if (value === null || value === undefined) return '';

  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// GET /api/technical-repairs/export  (solo tecnico/admin)
// Devuelve el listado filtrado en CSV (sin paginar).
async function exportCsv(req, res) {
  try {
    const { where, params, sortColumn, sortDirection } = buildFilters(req.query);

    const repairs = await db.prepare(`
      SELECT t.*, u.name AS assigned_to_name
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      ${where}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, t.id DESC
    `).all(...params);

    const headers = [
      'Nº boleta',
      'Estado',
      'Recibido',
      'Cliente',
      'DNI',
      'Teléfono',
      'Email',
      'Dirección',
      'Artículo',
      'Marca',
      'Modelo',
      'Nº serie',
      'Daño reportado',
      'Notas',
      'Fecha probable',
      'Técnico asignado',
    ];

    const rows = repairs.map((repair) => [
      repair.ticket_number,
      repair.status,
      formatDateTime(repair.received_at),
      repair.client_name,
      repair.client_id,
      repair.client_phone,
      repair.client_email,
      repair.client_address,
      repair.article,
      repair.brand,
      repair.model,
      repair.serial_number,
      repair.damage_reported,
      repair.notes,
      formatDateOnly(repair.probable_repair_date),
      repair.assigned_to_name,
    ]);

    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reparaciones-${stamp}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al exportar las reparaciones' });
  }
}

// POST /api/technical-repairs  (solo tecnico/admin)
async function create(req, res) {
  try {
    const body = req.body;

    if (body.status && !(await statusExists(body.status))) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (body.assigned_to !== undefined && body.assigned_to !== null && !(await technicianExists(body.assigned_to))) {
      return res.status(400).json({ error: 'Técnico asignado inválido' });
    }

    const inserted = await db.prepare(`
      INSERT INTO technical_repairs (
        ticket_number, status, client_name, client_address, client_id, client_email, client_phone,
        article, brand, model, serial_number, damage_reported, notes, image_url, probable_repair_date,
        assigned_to
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `).run(
      body.ticket_number || generateTicketNumber(),
      body.status || 'pendiente',
      body.client_name,
      body.client_address || null,
      body.client_id || null,
      body.client_email || null,
      body.client_phone || null,
      body.article || null,
      body.brand || null,
      body.model || null,
      body.serial_number || null,
      body.damage_reported,
      body.notes || null,
      body.image_url || null,
      body.probable_repair_date || null,
      body.assigned_to ?? null
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
    const repair = await db.prepare(`
      SELECT t.*, u.name AS assigned_to_name
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = $1
    `).get(id);

    if (!repair || !repair.id) {
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
    const body = req.body;
    const existing = await db.prepare('SELECT * FROM technical_repairs WHERE id = $1').get(id);

    if (!existing || !existing.id) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    if (body.status !== undefined && !(await statusExists(body.status))) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (body.assigned_to !== undefined && body.assigned_to !== null && !(await technicianExists(body.assigned_to))) {
      return res.status(400).json({ error: 'Técnico asignado inválido' });
    }

    const updated = await db.prepare(`
      UPDATE technical_repairs SET
        ticket_number = $1, status = $2, client_name = $3, client_address = $4, client_id = $5,
        client_email = $6, client_phone = $7, article = $8, brand = $9, model = $10,
        serial_number = $11, damage_reported = $12, notes = $13, image_url = $14,
        probable_repair_date = $15, assigned_to = $16
      WHERE id = $17
      RETURNING *
    `).run(
      body.ticket_number || existing.ticket_number,
      body.status !== undefined ? body.status : existing.status,
      body.client_name !== undefined ? body.client_name : existing.client_name,
      pick(body, 'client_address', existing.client_address),
      pick(body, 'client_id', existing.client_id),
      pick(body, 'client_email', existing.client_email),
      pick(body, 'client_phone', existing.client_phone),
      pick(body, 'article', existing.article),
      pick(body, 'brand', existing.brand),
      pick(body, 'model', existing.model),
      pick(body, 'serial_number', existing.serial_number),
      body.damage_reported !== undefined ? body.damage_reported : existing.damage_reported,
      pick(body, 'notes', existing.notes),
      pick(body, 'image_url', existing.image_url),
      pick(body, 'probable_repair_date', existing.probable_repair_date),
      body.assigned_to !== undefined ? body.assigned_to : existing.assigned_to,
      id
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
    const existing = await db.prepare('SELECT id FROM technical_repairs WHERE id = $1').get(id);

    if (!existing || !existing.id) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    await db.prepare('DELETE FROM technical_repairs WHERE id = $1').run(id);
    res.json({ message: 'Orden de reparación eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la orden de reparación' });
  }
}

module.exports = {
  getAll,
  exportCsv,
  create,
  getOne,
  update,
  remove,
  getNextTicket,
  getTechnicians,
};
