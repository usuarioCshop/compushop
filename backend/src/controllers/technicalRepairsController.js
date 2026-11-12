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

// Error con status HTTP para que los catch respondan 400/404 en lugar de 500.
function httpError(status, message) {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
}

function sendError(res, error, fallbackMessage) {
  if (error && error.httpStatus) {
    return res.status(error.httpStatus).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: fallbackMessage });
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

// Normaliza las lineas de repuestos que llegan del body.
function normalizeParts(parts) {
  return (parts || []).map((part) => ({
    product_id: Number(part.product_id),
    quantity: Number(part.quantity),
    unit_price:
      part.unit_price === undefined || part.unit_price === null || part.unit_price === ''
        ? null
        : Number(part.unit_price),
  }));
}

// Bloquea los productos involucrados en orden ascendente de id. Asi dos
// reparaciones concurrentes que comparten productos no se traban entre si.
async function lockProductMap(tx, productIds) {
  const ids = [...new Set(productIds)].sort((a, b) => a - b);
  if (!ids.length) return new Map();

  const result = await tx.query(
    'SELECT id, name, price, stock, is_active FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [ids]
  );
  return new Map(result.rows.map((row) => [row.id, row]));
}

// Valida stock y descuenta cada repuesto, insertando la linea en repair_parts.
// El mapa de productos ya viene bloqueado por lockProductMap.
async function applyParts(tx, repairId, parts, productMap) {
  if (!parts.length) return;

  const seen = new Set();
  for (const part of parts) {
    if (seen.has(part.product_id)) {
      throw httpError(400, 'No se puede repetir el mismo repuesto en la boleta');
    }
    seen.add(part.product_id);

    const product = productMap.get(part.product_id);
    if (!product) {
      throw httpError(400, `El repuesto ${part.product_id} no existe`);
    }
    if (product.stock < part.quantity) {
      throw httpError(
        400,
        `Stock insuficiente para "${product.name}" (disponible: ${product.stock})`
      );
    }
  }

  for (const part of parts) {
    const product = productMap.get(part.product_id);
    const unitPrice = part.unit_price === null ? product.price : part.unit_price;

    await tx.prepare('UPDATE products SET stock = stock - $1 WHERE id = $2').run(
      part.quantity,
      product.id
    );
    product.stock -= part.quantity;

    await tx.prepare(
      `INSERT INTO repair_parts (repair_id, product_id, description, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`
    ).run(repairId, product.id, product.name, part.quantity, unitPrice);
  }
}

// Devuelve el stock de las lineas indicadas y actualiza el mapa en memoria.
async function restoreStock(tx, parts, productMap) {
  for (const part of parts) {
    const product = productMap.get(part.product_id);
    if (product) product.stock += part.quantity;
    await tx.prepare('UPDATE products SET stock = stock + $1 WHERE id = $2').run(
      part.quantity,
      part.product_id
    );
  }
}

// Trae una reparacion completa con sus repuestos y totales.
async function fetchRepairWithParts(id) {
  const repair = await db.prepare(`
    SELECT t.*, u.name AS assigned_to_name
    FROM technical_repairs t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = $1
  `).get(id);

  if (!repair || !repair.id) return null;

  const parts = await db.prepare(`
    SELECT rp.*, p.name AS product_name, p.stock AS product_stock, p.is_active AS product_active
    FROM repair_parts rp
    LEFT JOIN products p ON p.id = rp.product_id
    WHERE rp.repair_id = $1
    ORDER BY rp.id ASC
  `).all(id);

  const partsTotal = parts.reduce(
    (acc, part) => acc + Number(part.quantity) * Number(part.unit_price),
    0
  );
  const ivaAmount = laborIvaAmount(repair);

  return {
    ...repair,
    labor_iva_amount: ivaAmount,
    parts_total: partsTotal,
    total: Number(repair.labor_price || 0) + ivaAmount + partsTotal,
  };
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
    sendError(res, error, 'Error al calcular el próximo número de boleta');
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
    sendError(res, error, 'Error al obtener los técnicos');
  }
}

// GET /api/technical-repairs/parts-catalog  (solo tecnico/admin)
// Productos activos con stock para el selector de repuestos.
async function getPartsCatalog(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const params = [];
    let where = 'is_active = true AND stock > 0';

    if (search) {
      params.push(`%${search}%`);
      where += ' AND (name ILIKE $1 OR brand ILIKE $1)';
    }

    const products = await db.prepare(`
      SELECT id, name, brand, price, stock
      FROM products
      WHERE ${where}
      ORDER BY name ASC
      LIMIT 20
    `).all(...params);

    res.json({ products });
  } catch (error) {
    sendError(res, error, 'Error al obtener el catálogo de repuestos');
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

// Monto de IVA sobre mano de obra cuando esta habilitado.
function laborIvaAmount(repair) {
  if (!repair || !repair.labor_iva_enabled) return 0;
  return Number(repair.labor_price || 0) * (Number(repair.labor_iva_rate || 0) / 100);
}

const LABOR_IVA_SQL = `(CASE WHEN t.labor_iva_enabled THEN t.labor_price * t.labor_iva_rate / 100 ELSE 0 END)`;

// Subconsulta de totales de repuestos por reparacion, reutilizada en listado,
// export, stats y reportes.
const PARTS_TOTALS_JOIN = `
  LEFT JOIN (
    SELECT repair_id, SUM(quantity * unit_price) AS parts_total
    FROM repair_parts
    GROUP BY repair_id
  ) pt ON pt.repair_id = t.id
`;

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
      SELECT t.*, u.name AS assigned_to_name,
             COALESCE(pt.parts_total, 0) AS parts_total,
             ${LABOR_IVA_SQL} AS labor_iva_amount,
             t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0) AS total
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      ${PARTS_TOTALS_JOIN}
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
    sendError(res, error, 'Error al obtener reparaciones');
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

// Numero plano para CSV (sin simbolo de moneda).
function csvMoney(value) {
  return Number(value || 0).toFixed(2);
}

function sendCsv(res, filename, headers, rows) {
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// GET /api/technical-repairs/export  (solo tecnico/admin)
// Devuelve el listado filtrado en CSV (sin paginar).
async function exportCsv(req, res) {
  try {
    const { where, params, sortColumn, sortDirection } = buildFilters(req.query);

    const repairs = await db.prepare(`
      SELECT t.*, u.name AS assigned_to_name,
             COALESCE(pt.parts_total, 0) AS parts_total,
             ${LABOR_IVA_SQL} AS labor_iva_amount,
             t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0) AS total,
             COALESCE((
               SELECT string_agg(rp.quantity || 'x ' || rp.description, '; ' ORDER BY rp.id)
               FROM repair_parts rp
               WHERE rp.repair_id = t.id
             ), '') AS parts_summary
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      ${PARTS_TOTALS_JOIN}
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
      'Diagnóstico',
      'Repuestos',
      'Mano de obra',
      'IVA habilitado',
      'IVA %',
      'IVA mano de obra',
      'Total',
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
      repair.diagnosis,
      repair.parts_summary,
      csvMoney(repair.labor_price),
      repair.labor_iva_enabled ? 'Sí' : 'No',
      repair.labor_iva_enabled ? csvMoney(repair.labor_iva_rate) : '0.00',
      csvMoney(repair.labor_iva_amount),
      csvMoney(repair.total),
    ]);

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    sendCsv(res, `reparaciones-${stamp}.csv`, headers, rows);
  } catch (error) {
    sendError(res, error, 'Error al exportar las reparaciones');
  }
}

// GET /api/technical-repairs/stats  (solo tecnico/admin)
// KPIs del dashboard.
async function getStats(req, res) {
  try {
    const stats = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t.status = 'pendiente') AS pendientes,
        COUNT(*) FILTER (WHERE t.status = 'en_proceso') AS en_proceso,
        COUNT(*) FILTER (WHERE t.status = 'reparado') AS reparados,
        COUNT(*) FILTER (WHERE t.status = 'entregado') AS entregados,
        COUNT(*) FILTER (WHERE t.status = 'cancelado') AS cancelados,
        COALESCE(SUM(
          CASE
            WHEN t.status <> 'cancelado' AND t.received_at >= date_trunc('month', now())
            THEN t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0)
            ELSE 0
          END
        ), 0) AS month_income
      FROM technical_repairs t
      ${PARTS_TOTALS_JOIN}
    `).get();

    res.json({ stats });
  } catch (error) {
    sendError(res, error, 'Error al obtener las estadísticas');
  }
}

// Arma el WHERE de los reportes. El filtro `part` solo tiene sentido cuando se
// agrupa por repuesto, porque ahi existen los alias rp/p.
function buildReportFilters(query, includePart = false) {
  const { received_from, received_to, status, client, article, brand, part } = query;
  const conditions = ['1=1'];
  const params = [];

  if (received_from) {
    params.push(received_from);
    conditions.push(`t.received_at >= $${params.length}::date`);
  }

  if (received_to) {
    params.push(received_to);
    conditions.push(`t.received_at < ($${params.length}::date + interval '1 day')`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (client) {
    params.push(`%${client}%`);
    conditions.push(
      `(t.client_name ILIKE $${params.length} OR t.client_id ILIKE $${params.length})`
    );
  }

  if (article) {
    params.push(`%${article}%`);
    conditions.push(`t.article ILIKE $${params.length}`);
  }

  if (brand) {
    params.push(`%${brand}%`);
    conditions.push(`t.brand ILIKE $${params.length}`);
  }

  if (includePart && part) {
    params.push(`%${part}%`);
    conditions.push(
      `(p.name ILIKE $${params.length} OR rp.description ILIKE $${params.length})`
    );
  }

  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}

// Devuelve las filas y los totales de un reporte segun el criterio.
async function buildReport(groupBy, query) {
  if (groupBy === 'part') {
    const { where, params } = buildReportFilters(query, true);
    const rows = await db.prepare(`
      SELECT rp.product_id,
             COALESCE(p.name, rp.description) AS description,
             COALESCE(p.brand, '') AS brand,
             SUM(rp.quantity)::int AS quantity,
             COUNT(DISTINCT rp.repair_id)::int AS repairs,
             COALESCE(SUM(rp.quantity * rp.unit_price), 0) AS parts_total
      FROM repair_parts rp
      JOIN technical_repairs t ON t.id = rp.repair_id
      LEFT JOIN products p ON p.id = rp.product_id
      ${where}
      GROUP BY rp.product_id, COALESCE(p.name, rp.description), COALESCE(p.brand, '')
      ORDER BY parts_total DESC, description ASC
    `).all(...params);

    const totals = rows.reduce(
      (acc, row) => ({
        quantity: acc.quantity + Number(row.quantity),
        repairs: acc.repairs + Number(row.repairs),
        parts_total: acc.parts_total + Number(row.parts_total),
      }),
      { quantity: 0, repairs: 0, parts_total: 0 }
    );

    return { rows, totals };
  }

  const { where, params } = buildReportFilters(query);
  let select;
  let group;
  let order;

  if (groupBy === 'client') {
    select = `
      t.client_name AS client_name,
      t.client_id AS client_id,
      COUNT(*)::int AS count,
      COALESCE(SUM(pt.parts_total), 0) AS parts_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL}), 0) AS labor_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0)), 0) AS total
    `;
    group = 'GROUP BY t.client_name, t.client_id';
    order = 'ORDER BY total DESC, client_name ASC';
  } else if (groupBy === 'equipment') {
    select = `
      COALESCE(t.article, '(sin artículo)') AS article,
      COALESCE(t.brand, '') AS brand,
      COALESCE(t.model, '') AS model,
      COUNT(*)::int AS count,
      COALESCE(SUM(pt.parts_total), 0) AS parts_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL}), 0) AS labor_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0)), 0) AS total
    `;
    group = 'GROUP BY t.article, t.brand, t.model';
    order = 'ORDER BY count DESC, article ASC, brand ASC, model ASC';
  } else {
    select = `
      t.status AS status,
      COUNT(*)::int AS count,
      COALESCE(SUM(pt.parts_total), 0) AS parts_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL}), 0) AS labor_total,
      COALESCE(SUM(t.labor_price + ${LABOR_IVA_SQL} + COALESCE(pt.parts_total, 0)), 0) AS total
    `;
    group = 'GROUP BY t.status';
    order = 'ORDER BY t.status ASC';
  }

  const rows = await db.prepare(`
    SELECT ${select}
    FROM technical_repairs t
    ${PARTS_TOTALS_JOIN}
    ${where}
    ${group}
    ${order}
  `).all(...params);

  const totals = rows.reduce(
    (acc, row) => ({
      count: acc.count + Number(row.count),
      parts_total: acc.parts_total + Number(row.parts_total),
      labor_total: acc.labor_total + Number(row.labor_total),
      total: acc.total + Number(row.total),
    }),
    { count: 0, parts_total: 0, labor_total: 0, total: 0 }
  );

  return { rows, totals };
}

// GET /api/technical-repairs/reports?group_by=status|client|equipment|part
async function getReport(req, res) {
  try {
    const groupBy = req.query.group_by || 'status';
    const { rows, totals } = await buildReport(groupBy, req.query);
    res.json({ group_by: groupBy, rows, totals });
  } catch (error) {
    sendError(res, error, 'Error al generar el reporte');
  }
}

// GET /api/technical-repairs/reports/export
async function exportReportCsv(req, res) {
  try {
    const groupBy = req.query.group_by || 'status';
    const { rows, totals } = await buildReport(groupBy, req.query);

    const configs = {
      status: {
        headers: ['Estado', 'Cantidad', 'Repuestos', 'Mano de obra', 'Total'],
        row: (row) => [
          row.status,
          row.count,
          csvMoney(row.parts_total),
          csvMoney(row.labor_total),
          csvMoney(row.total),
        ],
        totalRow: [
          'Total',
          totals.count,
          csvMoney(totals.parts_total),
          csvMoney(totals.labor_total),
          csvMoney(totals.total),
        ],
      },
      client: {
        headers: ['Cliente', 'DNI', 'Cantidad', 'Repuestos', 'Mano de obra', 'Total'],
        row: (row) => [
          row.client_name,
          row.client_id,
          row.count,
          csvMoney(row.parts_total),
          csvMoney(row.labor_total),
          csvMoney(row.total),
        ],
        totalRow: [
          'Total',
          '',
          totals.count,
          csvMoney(totals.parts_total),
          csvMoney(totals.labor_total),
          csvMoney(totals.total),
        ],
      },
      equipment: {
        headers: [
          'Artículo',
          'Marca',
          'Modelo',
          'Cantidad',
          'Repuestos',
          'Mano de obra',
          'Total',
        ],
        row: (row) => [
          row.article,
          row.brand,
          row.model,
          row.count,
          csvMoney(row.parts_total),
          csvMoney(row.labor_total),
          csvMoney(row.total),
        ],
        totalRow: [
          'Total',
          '',
          '',
          totals.count,
          csvMoney(totals.parts_total),
          csvMoney(totals.labor_total),
          csvMoney(totals.total),
        ],
      },
      part: {
        headers: ['Repuesto', 'Marca', 'Cantidad usada', 'Boletas', 'Total repuestos'],
        row: (row) => [
          row.description,
          row.brand,
          row.quantity,
          row.repairs,
          csvMoney(row.parts_total),
        ],
        totalRow: [
          'Total',
          '',
          totals.quantity,
          totals.repairs,
          csvMoney(totals.parts_total),
        ],
      },
    };

    const config = configs[groupBy] || configs.status;
    const csvRows = rows.map(config.row);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    sendCsv(
      res,
      `reporte-${groupBy}-${stamp}.csv`,
      config.headers,
      [...csvRows, config.totalRow]
    );
  } catch (error) {
    sendError(res, error, 'Error al exportar el reporte');
  }
}

// POST /api/technical-repairs  (solo tecnico/admin)
async function create(req, res) {
  try {
    const body = req.body;

    if (body.status && !(await statusExists(body.status))) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (
      body.assigned_to !== undefined &&
      body.assigned_to !== null &&
      !(await technicianExists(body.assigned_to))
    ) {
      return res.status(400).json({ error: 'Técnico asignado inválido' });
    }

    const repair = await db.transaction(async (tx) => {
      const inserted = await tx.prepare(`
        INSERT INTO technical_repairs (
          ticket_number, status, client_name, client_address, client_id, client_email, client_phone,
          article, brand, model, serial_number, damage_reported, notes, image_url, probable_repair_date,
          assigned_to, diagnosis, labor_price, labor_iva_enabled, labor_iva_rate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
        body.assigned_to ?? null,
        body.diagnosis || null,
        body.labor_price ?? 0,
        body.labor_iva_enabled ?? false,
        body.labor_iva_rate ?? 21
      );

      const created = inserted.rows[0];
      const parts = normalizeParts(body.parts);

      if (parts.length) {
        const productMap = await lockProductMap(
          tx,
          parts.map((part) => part.product_id)
        );
        await applyParts(tx, created.id, parts, productMap);
      }

      return created;
    });

    const full = await fetchRepairWithParts(repair.id);
    res.status(201).json({ message: 'Orden de reparación creada', repair: full });
  } catch (error) {
    sendError(res, error, 'Error al crear la orden de reparación');
  }
}

// GET /api/technical-repairs/:id  (solo tecnico/admin)
async function getOne(req, res) {
  try {
    const repair = await fetchRepairWithParts(req.params.id);
    if (!repair) {
      return res.status(404).json({ error: 'Orden de reparación no encontrada' });
    }

    res.json({ repair });
  } catch (error) {
    sendError(res, error, 'Error al obtener la orden de reparación');
  }
}

// PUT /api/technical-repairs/:id  (solo tecnico/admin)
async function update(req, res) {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.status !== undefined && !(await statusExists(body.status))) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    if (
      body.assigned_to !== undefined &&
      body.assigned_to !== null &&
      !(await technicianExists(body.assigned_to))
    ) {
      return res.status(400).json({ error: 'Técnico asignado inválido' });
    }

    await db.transaction(async (tx) => {
      const existing = await tx
        .prepare('SELECT * FROM technical_repairs WHERE id = $1 FOR UPDATE')
        .get(id);

      if (!existing || !existing.id) {
        throw httpError(404, 'Orden de reparación no encontrada');
      }

      await tx.prepare(`
        UPDATE technical_repairs SET
          ticket_number = $1, status = $2, client_name = $3, client_address = $4, client_id = $5,
          client_email = $6, client_phone = $7, article = $8, brand = $9, model = $10,
          serial_number = $11, damage_reported = $12, notes = $13, image_url = $14,
          probable_repair_date = $15, assigned_to = $16, diagnosis = $17, labor_price = $18,
          labor_iva_enabled = $19, labor_iva_rate = $20
        WHERE id = $21
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
        pick(body, 'diagnosis', existing.diagnosis),
        body.labor_price !== undefined ? body.labor_price : existing.labor_price,
        body.labor_iva_enabled !== undefined ? body.labor_iva_enabled : existing.labor_iva_enabled,
        body.labor_iva_rate !== undefined ? body.labor_iva_rate : existing.labor_iva_rate,
        id
      );

      if (body.parts !== undefined) {
        const oldParts = await tx
          .prepare(
            'SELECT product_id, quantity FROM repair_parts WHERE repair_id = $1 ORDER BY product_id ASC'
          )
          .all(id);
        const newParts = normalizeParts(body.parts);

        const productMap = await lockProductMap(tx, [
          ...oldParts.map((part) => part.product_id),
          ...newParts.map((part) => part.product_id),
        ]);

        await restoreStock(tx, oldParts, productMap);
        await tx.prepare('DELETE FROM repair_parts WHERE repair_id = $1').run(id);
        await applyParts(tx, id, newParts, productMap);
      }
    });

    const full = await fetchRepairWithParts(id);
    res.json({ message: 'Orden de reparación actualizada', repair: full });
  } catch (error) {
    sendError(res, error, 'Error al actualizar la orden de reparación');
  }
}

// DELETE /api/technical-repairs/:id  (solo tecnico/admin)
async function remove(req, res) {
  try {
    const { id } = req.params;

    await db.transaction(async (tx) => {
      const existing = await tx
        .prepare('SELECT id FROM technical_repairs WHERE id = $1 FOR UPDATE')
        .get(id);

      if (!existing || !existing.id) {
        throw httpError(404, 'Orden de reparación no encontrada');
      }

      const parts = await tx
        .prepare(
          'SELECT product_id, quantity FROM repair_parts WHERE repair_id = $1 ORDER BY product_id ASC'
        )
        .all(id);

      if (parts.length) {
        const productMap = await lockProductMap(
          tx,
          parts.map((part) => part.product_id)
        );
        await restoreStock(tx, parts, productMap);
      }

      await tx.prepare('DELETE FROM technical_repairs WHERE id = $1').run(id);
    });

    res.json({ message: 'Orden de reparación eliminada' });
  } catch (error) {
    sendError(res, error, 'Error al eliminar la orden de reparación');
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
  getPartsCatalog,
  getStats,
  getReport,
  exportReportCsv,
};
