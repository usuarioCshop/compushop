const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const db = require('../db/database');
const arcaConfig = require('../config/arca');
const { ultimoAutorizado, solicitarCAE } = require('../arca/wsfe');
const { calcFiscalTotals } = require('../arca/fiscalCalc');
const { qrUrl } = require('../arca/qr');

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

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function toMoney(n) {
  return round2(n);
}

async function getIssuerSnapshot(txOrDb) {
  const runner = txOrDb || db;
  const rows = await runner.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach((r) => { s[r.key] = r.value; });
  return {
    razon_social: s.emisor_razon_social || s.store_name || '',
    nombre_fantasia: s.emisor_nombre_fantasia || '',
    cuit: s.emisor_cuit || '',
    domicilio: s.emisor_domicilio || s.store_address || '',
    condicion_iva: s.emisor_condicion_iva || '',
    iibb: s.emisor_iibb || '',
    inicio_actividades: s.emisor_inicio_actividades || '',
    telefono: s.emisor_telefono || s.store_phone || '',
    email: s.emisor_email || s.store_email || '',
    logo: s.emisor_logo || '',
  };
}

async function getNextNumberValue(txOrDb) {
  const runner = txOrDb || db;
  const row = await runner.prepare(`
    SELECT COALESCE(MAX(CAST(number AS INTEGER)), 0) AS max_num
    FROM invoices
    WHERE number ~ '^[0-9]+$'
  `).get();
  const next = Number(row?.max_num || 0) + 1;
  return String(next).padStart(8, '0');
}

function normalizeItem(raw) {
  const quantity = round2(raw.quantity ?? 1);
  const unitPrice = round2(raw.unit_price ?? 0);
  const vatRate = round2(raw.vat_rate ?? 0);
  const discount = round2(raw.discount ?? 0);
  const lineSubtotal = round2(quantity * unitPrice - discount);
  const vatAmount = round2(lineSubtotal * (vatRate / 100));
  const lineTotal = round2(lineSubtotal + vatAmount);
  return {
    source_type: raw.source_type || 'manual',
    product_id: raw.product_id ?? null,
    repair_id: raw.repair_id ?? null,
    description: String(raw.description || '').trim(),
    quantity,
    unit_price: unitPrice,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    discount,
    line_subtotal: lineSubtotal < 0 ? 0 : lineSubtotal,
    line_total: lineTotal < 0 ? 0 : lineTotal,
    metadata: raw.metadata || null,
  };
}

function calculateTotals(items) {
  const subtotal = round2(items.reduce((acc, it) => acc + Number(it.line_subtotal || 0), 0));
  const taxTotal = round2(items.reduce((acc, it) => acc + Number(it.vat_amount || 0), 0));
  const discountTotal = round2(items.reduce((acc, it) => acc + Number(it.discount || 0), 0));
  const total = round2(items.reduce((acc, it) => acc + Number(it.line_total || 0), 0));
  return { subtotal, tax_total: taxTotal, discount_total: discountTotal, total };
}

function parseItemMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try { return JSON.parse(metadata); } catch { return {}; }
}

function shouldDeductStockOnIssue(item) {
  const productId = Number(item.product_id || 0);
  const qty = Number(item.quantity || 0);
  if (!productId || qty <= 0) return false;
  const meta = parseItemMetadata(item.metadata);
  if (meta.stock_deducted === true || meta.stock_action === 'already_deducted' || meta.stock_action === 'none') return false;
  // Repuestos de reparación: se descontaron al utilizarlos en el servicio técnico
  if (item.source_type === 'repair' && meta.kind === 'part') return false;
  return true;
}

async function getStockNeedsForInvoice(tx, invoiceId) {
  const items = await tx.prepare('SELECT * FROM invoice_items WHERE invoice_id = $1').all(invoiceId);
  const needed = new Map();
  for (const it of items) {
    if (!shouldDeductStockOnIssue(it)) continue;
    const pid = Number(it.product_id);
    const qty = Number(it.quantity || 0);
    needed.set(pid, round2((needed.get(pid) || 0) + qty));
  }
  return needed;
}

async function validateInvoiceStockAvailability(tx, invoiceId, { lock = false } = {}) {
  const needed = await getStockNeedsForInvoice(tx, invoiceId);
  if (needed.size === 0) return needed;
  const ids = [...needed.keys()].sort((a, b) => a - b);
  const lockSql = lock ? ' FOR UPDATE' : '';
  const result = await tx.query(
    `SELECT id, name, stock FROM products WHERE id = ANY($1::int[]) ORDER BY id${lockSql}`,
    [ids]
  );
  const productMap = new Map(result.rows.map((r) => [Number(r.id), r]));
  for (const [pid, qty] of needed.entries()) {
    const p = productMap.get(pid);
    if (!p) throw httpError(400, `El producto ${pid} no existe para descontar stock`);
    if (Number(p.stock) < qty) {
      throw httpError(400, `Stock insuficiente para "${p.name}" (disponible: ${p.stock}, requerido: ${qty})`);
    }
  }
  return needed;
}

async function deductInvoiceStock(tx, invoiceId) {
  const needed = await validateInvoiceStockAvailability(tx, invoiceId, { lock: true });
  if (needed.size === 0) return;
  for (const [pid, qty] of needed.entries()) {
    const info = await tx.prepare('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1').run(qty, pid);
    if (info.changes === 0) {
      throw httpError(400, `Stock insuficiente para el producto ${pid} al emitir la factura`);
    }
  }
}

async function assertNoDoubleRepairInvoicing(tx, invoiceId) {
  const rows = await tx.prepare(`
    SELECT DISTINCT ii.repair_id, i2.id AS other_invoice_id, i2.number AS other_number
    FROM invoice_items ii
    JOIN invoices i2 ON i2.id = ii.invoice_id
    WHERE ii.invoice_id = $1
      AND ii.repair_id IS NOT NULL
      AND i2.status = 'emitida'
      AND i2.id <> $1
    LIMIT 1
  `).all(invoiceId);
  if (rows.length) {
    const r = rows[0];
    throw httpError(400, `La reparación #${r.repair_id} ya fue facturada en el comprobante ${r.other_number || '#' + r.other_invoice_id}`);
  }
}

async function fetchInvoiceWithItems(id, txOrDb) {
  const runner = txOrDb || db;
  const invoice = await runner.prepare(`
    SELECT i.*, bc.name AS billing_client_name, u.name AS created_by_name
    FROM invoices i
    LEFT JOIN billing_clients bc ON bc.id = i.billing_client_id
    LEFT JOIN users u ON u.id = i.created_by
    WHERE i.id = $1
  `).get(id);
  if (!invoice || !invoice.id) return null;
  const items = await runner.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC
  `).all(id);
  return { ...invoice, items };
}

// GET /api/invoices/next-number
async function getNextNumber(req, res) {
  try {
    const number = await getNextNumberValue();
    res.json({ number });
  } catch (error) {
    sendError(res, error, 'Error al obtener próximo número');
  }
}

// GET /api/invoices
async function getAll(req, res) {
  try {
    const { status, search, date_from, date_to, page = 1, limit = 20 } = req.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * take;
    const params = [];
    const conditions = ['1=1'];

    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(i.number ILIKE $${params.length} OR bc.name ILIKE $${params.length} OR i.receiver_snapshot->>'name' ILIKE $${params.length})`);
    }
    if (date_from) { params.push(date_from); conditions.push(`i.created_at >= $${params.length}::date`); }
    if (date_to) { params.push(date_to); conditions.push(`i.created_at < ($${params.length}::date + interval '1 day')`); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRow = await db.prepare(`
      SELECT COUNT(*)::int AS total
      FROM invoices i
      LEFT JOIN billing_clients bc ON bc.id = i.billing_client_id
      ${where}
    `).get(...params);

    params.push(take, offset);
    const invoices = await db.prepare(`
      SELECT i.*, bc.name AS billing_client_name, u.name AS created_by_name
      FROM invoices i
      LEFT JOIN billing_clients bc ON bc.id = i.billing_client_id
      LEFT JOIN users u ON u.id = i.created_by
      ${where}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `).all(...params);

    res.json({
      invoices,
      pagination: {
        page: Math.max(parseInt(page) || 1, 1),
        limit: take,
        total: countRow?.total || 0,
        pages: Math.ceil((countRow?.total || 0) / take),
      },
    });
  } catch (error) {
    sendError(res, error, 'Error al obtener facturas');
  }
}

// GET /api/invoices/:id
async function getOne(req, res) {
  try {
    const invoice = await fetchInvoiceWithItems(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ invoice });
  } catch (error) {
    sendError(res, error, 'Error al obtener factura');
  }
}

// POST /api/invoices (crear borrador)
async function create(req, res) {
  try {
    const body = req.body || {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (itemsInput.length === 0) return res.status(400).json({ error: 'La factura debe tener al menos un ítem' });
    const items = itemsInput.map(normalizeItem).filter((it) => it.description);
    if (items.length === 0) return res.status(400).json({ error: 'Los ítems deben tener descripción' });

    const totals = calculateTotals(items);
    const issuer = await getIssuerSnapshot();
    const receiver = body.receiver_snapshot || {};

    const invoice = await db.transaction(async (tx) => {
      const number = await getNextNumberValue(tx);
      const inserted = await tx.prepare(`
        INSERT INTO invoices (number, status, billing_client_id, issuer_snapshot, receiver_snapshot, currency, subtotal, tax_total, discount_total, total, notes, created_by)
        VALUES ($1, 'borrador', $2, $3, $4, 'ARS', $5, $6, $7, $8, $9, $10)
        RETURNING id
      `).run(
        number,
        body.billing_client_id || null,
        JSON.stringify(issuer),
        JSON.stringify(receiver),
        totals.subtotal, totals.tax_total, totals.discount_total, totals.total,
        body.notes || null,
        req.user?.id || null
      );
      const id = inserted.rows[0].id;
      const insertItem = tx.prepare(`
        INSERT INTO invoice_items (invoice_id, source_type, product_id, repair_id, description, quantity, unit_price, vat_rate, vat_amount, discount, line_subtotal, line_total, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `);
      for (const it of items) {
        await insertItem.run(id, it.source_type, it.product_id, it.repair_id, it.description, it.quantity, it.unit_price, it.vat_rate, it.vat_amount, it.discount, it.line_subtotal, it.line_total, it.metadata ? JSON.stringify(it.metadata) : null);
      }
      return await fetchInvoiceWithItems(id, tx);
    });

    res.status(201).json({ invoice });
  } catch (error) {
    sendError(res, error, 'Error al crear factura');
  }
}

// PUT /api/invoices/:id (actualizar borrador)
async function update(req, res) {
  try {
    const body = req.body || {};
    const invoice = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM invoices WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing || !existing.id) throw httpError(404, 'Factura no encontrada');
      if (existing.status !== 'borrador') throw httpError(400, 'Solo se puede editar una factura en borrador');

      let items = null;
      let totals = { subtotal: existing.subtotal, tax_total: existing.tax_total, discount_total: existing.discount_total, total: existing.total };
      if (Array.isArray(body.items)) {
        items = body.items.map(normalizeItem).filter((it) => it.description);
        if (items.length === 0) throw httpError(400, 'La factura debe tener al menos un ítem');
        totals = calculateTotals(items);
      }

      const receiver = body.receiver_snapshot !== undefined ? body.receiver_snapshot : existing.receiver_snapshot;
      await tx.prepare(`
        UPDATE invoices SET
          billing_client_id = $1, receiver_snapshot = $2, notes = $3,
          subtotal = $4, tax_total = $5, discount_total = $6, total = $7
        WHERE id = $8
      `).run(
        body.billing_client_id !== undefined ? body.billing_client_id : existing.billing_client_id,
        typeof receiver === 'string' ? receiver : JSON.stringify(receiver || {}),
        body.notes !== undefined ? (body.notes || null) : existing.notes,
        totals.subtotal, totals.tax_total, totals.discount_total, totals.total,
        req.params.id
      );

      if (items) {
        await tx.prepare('DELETE FROM invoice_items WHERE invoice_id = $1').run(req.params.id);
        const insertItem = tx.prepare(`
          INSERT INTO invoice_items (invoice_id, source_type, product_id, repair_id, description, quantity, unit_price, vat_rate, vat_amount, discount, line_subtotal, line_total, metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `);
        for (const it of items) {
          await insertItem.run(req.params.id, it.source_type, it.product_id, it.repair_id, it.description, it.quantity, it.unit_price, it.vat_rate, it.vat_amount, it.discount, it.line_subtotal, it.line_total, it.metadata ? JSON.stringify(it.metadata) : null);
        }
      }

      return await fetchInvoiceWithItems(req.params.id, tx);
    });
    res.json({ invoice });
  } catch (error) {
    sendError(res, error, 'Error al actualizar factura');
  }
}

// POST /api/invoices/:id/issue
async function issue(req, res) {
  try {
    const invoice = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM invoices WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing || !existing.id) throw httpError(404, 'Factura no encontrada');
      if (existing.status !== 'borrador') throw httpError(400, 'Solo se puede emitir una factura en borrador');
      const items = await tx.prepare('SELECT * FROM invoice_items WHERE invoice_id = $1').all(req.params.id);
      if (!items.length) throw httpError(400, 'La factura debe tener al menos un ítem');

      const receiver = existing.receiver_snapshot || {};
      if (!receiver.name || !String(receiver.name).trim()) {
        throw httpError(400, 'El receptor debe tener nombre para emitir la factura');
      }

      // Recalcular por seguridad
      const normalized = items.map((it) => {
        const n = normalizeItem(it);
        n.metadata = parseItemMetadata(it.metadata);
        return n;
      });
      const totals = calculateTotals(normalized);
      const issuer = await getIssuerSnapshot(tx);

      // actualizar ítems recalculados
      await tx.prepare('DELETE FROM invoice_items WHERE invoice_id = $1').run(req.params.id);
      const insertItem = tx.prepare(`
        INSERT INTO invoice_items (invoice_id, source_type, product_id, repair_id, description, quantity, unit_price, vat_rate, vat_amount, discount, line_subtotal, line_total, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `);
      for (const it of normalized) {
        await insertItem.run(req.params.id, it.source_type, it.product_id, it.repair_id, it.description, it.quantity, it.unit_price, it.vat_rate, it.vat_amount, it.discount, it.line_subtotal, it.line_total, it.metadata && Object.keys(it.metadata).length ? JSON.stringify(it.metadata) : null);
      }

      // Evitar doble facturación de reparaciones
      await assertNoDoubleRepairInvoicing(tx, req.params.id);

      // Descontar stock según reglas (F-D1/F-D2): al emitir, salvo ítems ya descontados
      await deductInvoiceStock(tx, req.params.id);

      // Asegurar número único (ya asignado en borrador; mantenerlo)
      await tx.prepare(`
        UPDATE invoices SET
          status = 'emitida', issued_at = now(), issuer_snapshot = $1,
          subtotal = $2, tax_total = $3, discount_total = $4, total = $5
        WHERE id = $6
      `).run(JSON.stringify(issuer), totals.subtotal, totals.tax_total, totals.discount_total, totals.total, req.params.id);

      return await fetchInvoiceWithItems(req.params.id, tx);
    });
    res.json({ invoice });
  } catch (error) {
    sendError(res, error, 'Error al emitir factura');
  }
}

// POST /api/invoices/:id/void
async function voidInvoice(req, res) {
  try {
    const reason = (req.body?.reason || '').trim();
    const invoice = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM invoices WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing || !existing.id) throw httpError(404, 'Factura no encontrada');
      if (existing.status !== 'emitida') throw httpError(400, 'Solo se puede anular una factura emitida');
      await tx.prepare(`
        UPDATE invoices SET status = 'anulada', voided_at = now(), void_reason = $1, voided_by = $2
        WHERE id = $3
      `).run(reason || null, req.user?.id || null, req.params.id);
      return await fetchInvoiceWithItems(req.params.id, tx);
    });
    res.json({ invoice });
  } catch (error) {
    sendError(res, error, 'Error al anular factura');
  }
}

// DELETE /api/invoices/:id (solo borrador)
async function remove(req, res) {
  try {
    const existing = await db.prepare('SELECT status FROM invoices WHERE id = $1').get(req.params.id);
    if (!existing || !existing.status) return res.status(404).json({ error: 'Factura no encontrada' });
    if (existing.status !== 'borrador') return res.status(400).json({ error: 'Solo se puede eliminar una factura en borrador' });
    await db.prepare('DELETE FROM invoices WHERE id = $1').run(req.params.id);
    res.json({ message: 'Factura eliminada' });
  } catch (error) {
    sendError(res, error, 'Error al eliminar factura');
  }
}

// GET /api/invoices/preload/product/:id
async function preloadProduct(req, res) {
  try {
    const product = await db.prepare('SELECT * FROM products WHERE id = $1').get(req.params.id);
    if (!product || !product.id) return res.status(404).json({ error: 'Producto no encontrado' });
    const item = normalizeItem({
      source_type: 'product',
      product_id: product.id,
      description: product.name,
      quantity: 1,
      unit_price: Number(product.price || 0),
      vat_rate: Number(product.vat_rate || 0),
    });
    res.json({ item });
  } catch (error) {
    sendError(res, error, 'Error al precargar producto');
  }
}

// GET /api/invoices/preload/repair/:id
async function preloadRepair(req, res) {
  try {
    const repair = await db.prepare(`
      SELECT t.*, u.name AS assigned_to_name
      FROM technical_repairs t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.id = $1
    `).get(req.params.id);
    if (!repair || !repair.id) return res.status(404).json({ error: 'Reparación no encontrada' });

    const parts = await db.prepare(`
      SELECT rp.*, p.name AS product_name, p.vat_rate AS product_vat_rate
      FROM repair_parts rp
      LEFT JOIN products p ON p.id = rp.product_id
      WHERE rp.repair_id = $1
      ORDER BY rp.id ASC
    `).all(req.params.id);

    const items = [];
    // Mano de obra como línea
    const laborPrice = Number(repair.labor_price || 0);
    if (laborPrice > 0 || repair.labor_iva_enabled) {
      items.push(normalizeItem({
        source_type: 'repair',
        repair_id: repair.id,
        description: `Mano de obra - ${repair.ticket_number || `Reparación #${repair.id}`}`,
        quantity: 1,
        unit_price: laborPrice,
        vat_rate: repair.labor_iva_enabled ? Number(repair.labor_iva_rate || 0) : 0,
        metadata: { kind: 'labor', ticket_number: repair.ticket_number },
      }));
    }
    // Repuestos: stock ya descontado al utilizarlos en el servicio técnico
    for (const p of parts) {
      items.push(normalizeItem({
        source_type: 'repair',
        repair_id: repair.id,
        product_id: p.product_id,
        description: p.description || p.product_name || 'Repuesto',
        quantity: Number(p.quantity || 1),
        unit_price: Number(p.unit_price || 0),
        vat_rate: Number(p.product_vat_rate || 0),
        metadata: { kind: 'part', ticket_number: repair.ticket_number, stock_deducted: true, stock_action: 'already_deducted' },
      }));
    }

    if (items.length === 0) {
      // Al menos una línea descriptiva si no hay montos
      items.push(normalizeItem({
        source_type: 'repair',
        repair_id: repair.id,
        description: `Servicio técnico - ${repair.ticket_number || `Reparación #${repair.id}`} (${repair.article || 'Equipo'})`,
        quantity: 1,
        unit_price: 0,
        vat_rate: 0,
        metadata: { kind: 'service', ticket_number: repair.ticket_number },
      }));
    }

    const receiver = {
      name: repair.client_name || '',
      doc_type: repair.client_id ? 'DNI' : '',
      doc_number: repair.client_id || '',
      address: repair.client_address || '',
      email: repair.client_email || '',
      phone: repair.client_phone || '',
      condicion_iva: '',
    };

    const alreadyInvoiced = await db.prepare(`
      SELECT DISTINCT i.id, i.number, i.status, i.arca_status
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.repair_id = $1 AND i.status = 'emitida'
      ORDER BY i.id DESC
      LIMIT 5
    `).all(req.params.id);

    res.json({ items, receiver, repair: { id: repair.id, ticket_number: repair.ticket_number, article: repair.article, brand: repair.brand, model: repair.model }, already_invoiced: alreadyInvoiced });
  } catch (error) {
    sendError(res, error, 'Error al precargar reparación');
  }
}

function formatMoneyPdf(value) {
  return `$ ${round2(value).toFixed(2)}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleString('es-AR');
}

// GET /api/invoices/:id/pdf
async function getPdf(req, res) {
  try {
    const invoice = await fetchInvoiceWithItems(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

    const issuerSnap = invoice.issuer_snapshot || {};
    const receiverSnap = invoice.receiver_snapshot || {};
    const items = invoice.items || [];
    const isFiscalApproved = invoice.arca_status === 'approved' && invoice.arca_cae;
    const cbteTipo = Number(invoice.cbte_tipo || 0);
    const tipoInfo = arcaConfig.TIPOS_CBTE[cbteTipo] || {};
    const letra = tipoInfo.letra || (isFiscalApproved ? '' : 'X');
    const cod = tipoInfo.cod || '--';
    const isA = letra === 'A';

    const COND = { 1: 'IVA Responsable Inscripto', 4: 'IVA Sujeto Exento', 5: 'Consumidor Final', 6: 'Responsable Monotributo', 13: 'Monotributista Social', 15: 'IVA No Alcanzado', 16: 'Monotributista Trab. Indep. Promovido' };
    const money = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fdate = (d) => {
      if (!d) return '-';
      const s = String(d).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/');
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('es-AR');
    };

    const fiscalNumber = isFiscalApproved && invoice.cbte_numero
      ? `${String(invoice.pto_vta || 0).padStart(4, '0')}-${String(invoice.cbte_numero).padStart(8, '0')}`
      : (invoice.number || String(invoice.id));
    const displayDate = invoice.cbte_fecha || invoice.issued_at || invoice.created_at;
    const emisorNombre = issuerSnap.razon_social || issuerSnap.nombre_fantasia || 'Compushop';
    const emisorDomicilio = issuerSnap.domicilio || issuerSnap.address || '-';
    const emisorCuit = issuerSnap.cuit || '';
    const emisorIibb = issuerSnap.iibb || '-';
    const emisorInicio = issuerSnap.inicio_actividades || '';
    const emisorCondIva = issuerSnap.condicion_iva || 'Responsable Inscripto';

    const recName = receiverSnap.name || invoice.receptor_nombre || '-';
    const recDocNro = String(receiverSnap.doc_number || invoice.receptor_doc_nro || '').replace(/\D/g, '');
    const recDocTipoNum = Number(invoice.receptor_doc_tipo || (recDocNro.length === 11 ? 80 : (recDocNro ? 96 : 99)));
    const recCondId = Number(invoice.receptor_condicion_iva_id || 0);
    const recCondText = COND[recCondId] || receiverSnap.condicion_iva || (recDocTipoNum === 99 ? 'Consumidor Final' : '-');
    const recAddress = receiverSnap.address || invoice.receptor_domicilio || '-';

    const caeId = invoice.arca_cae ? String(invoice.arca_cae).replace(/[^0-9A-Za-z-]/g, '_') : '';
    const filename = caeId ? `factura-CAE-${caeId}.pdf` : `factura-${fiscalNumber.replace(/[^0-9A-Za-z-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    doc.pipe(res);
    const L = 30, R = 565, W = R - L;

    // Encabezado
    doc.rect(L, 30, W, 100).stroke();
    doc.moveTo(300, 80).lineTo(300, 130).stroke();
    doc.rect(280, 30, 40, 44).fillAndStroke('#fff', '#000');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(28).text(letra || '-', 280, 36, { width: 40, align: 'center' });
    doc.fontSize(7).font('Helvetica').text(`COD. ${cod}`, 280, 66, { width: 40, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(14).text(emisorNombre, L + 10, 42, { width: 240 });
    doc.font('Helvetica').fontSize(9).text(emisorDomicilio, L + 10, 68, { width: 240 });
    doc.text(`Condición frente al IVA: ${emisorCondIva}`, L + 10, 104, { width: 240 });

    doc.font('Helvetica-Bold').fontSize(16).text(isFiscalApproved ? 'FACTURA' : 'COMPROBANTE', 335, 40);
    doc.fontSize(10).text(`Nº ${fiscalNumber}`, 335, 62);
    doc.font('Helvetica').fontSize(9).text(`Fecha de emisión: ${fdate(displayDate)}`, 335, 80);
    doc.text(`CUIT: ${emisorCuit || '-'}   Ing. Brutos: ${emisorIibb || '-'}`, 335, 93);
    doc.text(`Inicio de actividades: ${fdate(emisorInicio)}`, 335, 106);

    // Marca de agua estado
    if (invoice.status !== 'emitida' || invoice.arca_status === 'rejected' || invoice.arca_status === 'pending') {
      let mark = '';
      if (invoice.status === 'anulada') mark = 'ANULADA';
      else if (invoice.arca_status === 'rejected') mark = 'RECHAZADA';
      else if (invoice.arca_status === 'pending') mark = 'PENDIENTE ARCA';
      else if (invoice.status === 'borrador') mark = 'BORRADOR';
      if (mark) {
        doc.save();
        doc.fontSize(40).fillColor(mark === 'BORRADOR' || mark === 'PENDIENTE ARCA' ? '#bbbbbb' : '#cc0000').opacity(0.2)
          .text(mark, L, 300, { align: 'center', width: W });
        doc.restore();
        doc.fillColor('#000').opacity(1);
      }
    }

    // Receptor
    const docLabel = recDocTipoNum === 80 ? 'CUIT:' : recDocTipoNum === 96 ? 'DNI:' : 'Doc.:';
    doc.rect(L, 138, W, 58).stroke();
    doc.font('Helvetica-Bold').fontSize(9).text(docLabel, L + 8, 146);
    doc.font('Helvetica').text(recDocTipoNum === 99 ? '-' : (recDocNro || '-'), L + 45, 146);
    doc.font('Helvetica-Bold').text('Razón social:', 250, 146).font('Helvetica').text(recName, 320, 146, { width: 240 });
    doc.font('Helvetica-Bold').text('Cond. IVA:', L + 8, 164).font('Helvetica').text(recCondText, L + 62, 164, { width: 180 });
    doc.font('Helvetica-Bold').text('Domicilio:', 250, 164).font('Helvetica').text(recAddress, 320, 164, { width: 240 });
    doc.font('Helvetica-Bold').text('Cond. de venta:', L + 8, 182).font('Helvetica').text('Contado', L + 90, 182);

    // Ítems
    let y = 210;
    doc.rect(L, y, W, 18).fill('#e8e8e8').fillColor('#000');
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('Descripción', L + 6, y + 5).text('Cant.', 320, y + 5, { width: 40, align: 'right' })
      .text(isA ? 'P. unit. neto' : 'P. unit.', 365, y + 5, { width: 70, align: 'right' })
      .text('% IVA', 440, y + 5, { width: 40, align: 'right' })
      .text('Subtotal', 485, y + 5, { width: 75, align: 'right' });
    y += 24;
    doc.font('Helvetica').fontSize(9);

    const lines = items.map((it) => {
      const qty = Number(it.quantity || 0);
      const unitPrice = Number(it.unit_price || 0);
      const ivaRate = Number(it.vat_rate || 0);
      const discount = Number(it.discount || 0);
      const subtotal = round2(qty * unitPrice - discount);
      return { description: String(it.description || ''), qty, unitPrice, ivaRate, subtotal };
    });

    for (const it of lines) {
      if (y > 620) { doc.addPage(); y = 40; }
      const k = isA ? 1 : 1 + it.ivaRate / 100;
      doc.text(it.description, L + 6, y, { width: 280 });
      doc.text(String(it.qty), 320, y, { width: 40, align: 'right' });
      doc.text(money(it.unitPrice * k), 365, y, { width: 70, align: 'right' });
      doc.text(`${it.ivaRate}%`, 440, y, { width: 40, align: 'right' });
      doc.text(money(it.subtotal * k), 485, y, { width: 75, align: 'right' });
      y = Math.max(doc.y, y + 14) + 4;
    }

    // Totales
    y = Math.max(y + 10, 620);
    doc.moveTo(L, y).lineTo(R, y).stroke();
    y += 8;
    const row = (label, val, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
        .text(label, 360, y, { width: 100, align: 'right' })
        .text(money(val), 465, y, { width: 95, align: 'right' });
      y += bold ? 18 : 14;
    };

    if (isA) {
      const groups = new Map();
      for (const it of lines) groups.set(it.ivaRate, round2((groups.get(it.ivaRate) || 0) + it.subtotal));
      row('Importe neto:', invoice.subtotal);
      for (const [rate, base] of [...groups.entries()].sort((a,b)=>a[0]-b[0])) {
        row(`IVA ${rate}%:`, round2(base * rate / 100));
      }
    }
    row('TOTAL:', invoice.total, true);
    if (!isA) {
      doc.font('Helvetica').fontSize(8).text(
        `Régimen de Transparencia Fiscal (Ley 27.743) - IVA contenido: ${money(invoice.tax_total)}`,
        360, y, { width: 200, align: 'right' }
      );
      y += 14;
    }

    if (invoice.notes) {
      doc.font('Helvetica').fontSize(9).text('Notas:', L, y + 4);
      doc.fontSize(8.5).text(String(invoice.notes), L, y + 16, { width: 300 });
    }

    // QR + CAE
    if (isFiscalApproved) {
      try {
        const url = qrUrl({
          fecha: invoice.cbte_fecha || displayDate,
          cuit: cleanCuit(emisorCuit),
          ptoVta: invoice.pto_vta,
          tipoCmp: invoice.cbte_tipo,
          nroCmp: invoice.cbte_numero,
          importe: Number(invoice.total),
          tipoDocRec: invoice.receptor_doc_tipo || recDocTipoNum || 99,
          nroDocRec: invoice.receptor_doc_nro || recDocNro || 0,
          cae: invoice.arca_cae,
        });
        const qr = await QRCode.toBuffer(url, { margin: 0, width: 220 });
        doc.image(qr, L, 745, { width: 90 });
        doc.font('Helvetica-Bold').fontSize(9).text(`CAE Nº: ${invoice.arca_cae}`, 440, 760, { width: 125, align: 'right' })
          .text(`Vto. CAE: ${fdate(invoice.arca_cae_vto)}`, 440, 775, { width: 125, align: 'right' });
        doc.font('Helvetica-Oblique').fontSize(8).text('Comprobante Autorizado', 135, 760);
      } catch (e) {
        console.error('QR/PDF fiscal error:', e.message);
      }
    } else if (invoice.arca_status === 'rejected') {
      doc.font('Helvetica').fontSize(8).fillColor('red').text(`ARCA rechazado: ${invoice.arca_errors || ''}`, L, 760, { width: 530 });
      doc.fillColor('black');
    } else if (invoice.status === 'anulada') {
      doc.font('Helvetica').fontSize(8).fillColor('red').text(`ANULADA${invoice.void_reason ? ` - Motivo: ${invoice.void_reason}` : ''}`, L, 760, { width: 530 });
      doc.fillColor('black');
    }

    doc.end();
  } catch (error) {
    if (!res.headersSent) sendError(res, error, 'Error al generar PDF');
    else console.error(error);
  }
}

const A_OK = [1, 6, 13, 16]; // condiciones IVA receptor habilitadas para Factura A

function todayAr() {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
}

function cleanCuit(value) {
  return String(value || '').replace(/\D/g, '');
}

async function getFiscalIssuer(txOrDb) {
  const runner = txOrDb || db;
  const rows = await runner.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach((r) => { s[r.key] = r.value; });
  return arcaConfig.getIssuerConfig({
    cuit: s.emisor_cuit || process.env.EMISOR_CUIT,
    razonSocial: s.emisor_razon_social || s.store_name || process.env.EMISOR_RAZON_SOCIAL,
    domicilio: s.emisor_domicilio || s.store_address || process.env.EMISOR_DOMICILIO,
    iibb: s.emisor_iibb || process.env.EMISOR_IIBB,
    inicioAct: s.emisor_inicio_actividades || process.env.EMISOR_INICIO_ACT,
    condicionIva: s.emisor_condicion_iva || process.env.EMISOR_CONDICION_IVA,
    ptoVta: process.env.PTO_VTA, // pto vta suele ser técnico/config env
  });
}

function validateArcaPayload(payload) {
  const tipo = Number(payload.cbte_tipo);
  const concepto = Number(payload.concepto || 1);
  if (![1, 6].includes(tipo)) throw httpError(400, 'Tipo de comprobante inválido (1=A, 6=B)');
  if (![1, 2, 3].includes(concepto)) throw httpError(400, 'Concepto inválido');
  const receptor = payload.receptor || {};
  const docTipo = Number(receptor.docTipo ?? receptor.doc_tipo ?? (receptor.doc_number ? 96 : 99));
  let docNro = String(receptor.docNro ?? receptor.doc_nro ?? receptor.doc_number ?? '0').replace(/\D/g, '');
  const condIva = Number(receptor.condIva ?? receptor.condicion_iva_id ?? receptor.condicion_iva ?? 5);
  if (![80, 96, 99].includes(docTipo)) throw httpError(400, 'Tipo de documento inválido');
  if (docTipo === 99) docNro = '0';
  else if (!/^\d{7,11}$/.test(docNro)) throw httpError(400, 'Número de documento inválido');
  if (docTipo === 80 && docNro.length !== 11) throw httpError(400, 'El CUIT debe tener 11 dígitos');
  if (tipo === 1 && (docTipo !== 80 || !A_OK.includes(condIva))) {
    throw httpError(400, 'Factura A requiere CUIT y receptor Responsable Inscripto o Monotributista habilitado');
  }
  if (tipo === 6 && condIva === 1) {
    throw httpError(400, 'A un Responsable Inscripto corresponde Factura A');
  }
  if (!condIva) throw httpError(400, 'Falta la condición frente al IVA del receptor');
  const servicio = concepto !== 1 ? {
    desde: payload.servicio?.desde,
    hasta: payload.servicio?.hasta,
    vtoPago: payload.servicio?.vtoPago || payload.servicio?.vto_pago,
  } : null;
  if (concepto !== 1 && !(servicio?.desde && servicio?.hasta && servicio?.vtoPago)) {
    throw httpError(400, 'Completá las fechas del servicio (desde, hasta, vencimiento de pago)');
  }
  return {
    tipo, concepto, docTipo, docNro, condIva, servicio,
    receptorName: receptor.name || receptor.nombre || '',
    receptorAddress: receptor.address || receptor.domicilio || '',
  };
}

// POST /api/invoices/:id/arca-authorize
async function authorizeArca(req, res) {
  try {
    const payload = req.body || {};
    const v = validateArcaPayload(payload);
    const issuer = await getFiscalIssuer();
    if (!cleanCuit(issuer.cuit)) throw httpError(400, 'Falta CUIT del emisor (configuración ARCA/Ajustes)');
    if (!arcaConfig.hasArcaCredentials()) throw httpError(400, 'Faltan certificado y/o clave privada de ARCA');

    const result = await db.transaction(async (tx) => {
      const invoice = await fetchInvoiceWithItems(req.params.id, tx);
      if (!invoice) throw httpError(404, 'Factura no encontrada');
      if (invoice.status === 'anulada') throw httpError(400, 'No se puede autorizar una factura anulada');
      if (invoice.arca_status === 'approved') throw httpError(400, 'La factura ya fue autorizada por ARCA');

      const items = (invoice.items || []).map((it) => ({
        description: it.description,
        qty: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        ivaRate: Number(it.vat_rate),
        discount: Number(it.discount || 0),
      }));
      const fiscalTotals = calcFiscalTotals(items);
      const ptoVta = Number(payload.pto_vta || issuer.ptoVta || 1);
      const fecha = todayAr();

      let ultimo;
      let numero;
      try {
        ultimo = await ultimoAutorizado(ptoVta, v.tipo, issuer.cuit, tx);
        numero = ultimo + 1;
      } catch (e) {
        const msg = String(e.message || e);
        throw httpError(502, msg.startsWith('WSAA:') || msg.startsWith('WSFE:') ? msg : `Error al consultar último comprobante en ARCA: ${msg}`);
      }

      await tx.prepare(`
        UPDATE invoices SET
          pto_vta = $1, cbte_tipo = $2, cbte_numero = $3, cbte_fecha = $4, concepto = $5,
          receptor_doc_tipo = $6, receptor_doc_nro = $7, receptor_condicion_iva_id = $8,
          receptor_nombre = $9, receptor_domicilio = $10,
          arca_status = 'pending', arca_errors = NULL, arca_observations = NULL, arca_result = NULL,
          fiscal_totals = $11
        WHERE id = $12
      `).run(
        ptoVta, v.tipo, numero, fecha, v.concepto,
        v.docTipo, v.docNro, v.condIva,
        v.receptorName || invoice.receiver_snapshot?.name || '',
        v.receptorAddress || invoice.receiver_snapshot?.address || '',
        JSON.stringify(fiscalTotals),
        invoice.id
      );

      const receptor = {
        docTipo: v.docTipo,
        docNro: v.docNro,
        condIva: v.condIva,
        name: v.receptorName || invoice.receiver_snapshot?.name || '',
        address: v.receptorAddress || invoice.receiver_snapshot?.address || '',
      };

      // Si autorizar implica emitir (borrador), validar doble facturación de reparaciones y stock antes de solicitar CAE.
      if (invoice.status === 'borrador') {
        await assertNoDoubleRepairInvoicing(tx, invoice.id);
        await validateInvoiceStockAvailability(tx, invoice.id, { lock: true });
      }

      let arcaRes;
      try {
        arcaRes = await solicitarCAE({
          tipo: v.tipo,
          numero,
          fecha,
          concepto: v.concepto,
          ptoVta,
          receptor,
          totals: fiscalTotals,
          servicio: v.servicio,
        }, issuer.cuit, tx);
      } catch (e) {
        await tx.prepare(`UPDATE invoices SET arca_status = 'rejected', arca_errors = $1 WHERE id = $2`)
          .run(String(e.message || e), invoice.id);
        const msg = String(e.message || e);
        throw httpError(502, msg.startsWith('WSAA:') || msg.startsWith('WSFE:') || msg.startsWith('Error al solicitar CAE') ? msg : `Error al solicitar CAE: ${msg}`);
      }

      if (!arcaRes.approved) {
        await tx.prepare(`
          UPDATE invoices SET arca_status = 'rejected', arca_errors = $1, arca_observations = $2, arca_result = $3
          WHERE id = $4
        `).run(
          (arcaRes.messages || []).join(' | ') || 'Rechazado por ARCA',
          JSON.stringify(arcaRes.messages || []),
          JSON.stringify(arcaRes.raw || {}),
          invoice.id
        );
        const updated = await fetchInvoiceWithItems(invoice.id, tx);
        return { invoice: updated, arca: arcaRes, rejected: true };
      }

      // Aprobado: si estaba en borrador, descontar stock y marcar emitida internamente
      if (invoice.status === 'borrador') {
        await deductInvoiceStock(tx, invoice.id);
      }
      const issuedAtUpdate = invoice.status === 'borrador' ? ', status = \'emitida\', issued_at = COALESCE(issued_at, now())' : '';
      await tx.prepare(`
        UPDATE invoices SET
          arca_status = 'approved', arca_cae = $1, arca_cae_vto = $2,
          arca_observations = $3, arca_result = $4, arca_errors = NULL
          ${issuedAtUpdate}
        WHERE id = $5
      `).run(
        arcaRes.cae,
        arcaRes.caeVto,
        JSON.stringify(arcaRes.messages || []),
        JSON.stringify(arcaRes.raw || {}),
        invoice.id
      );

      const updated = await fetchInvoiceWithItems(invoice.id, tx);
      return { invoice: updated, arca: arcaRes, rejected: false };
    });

    if (result.rejected) {
      return res.status(422).json({ error: 'ARCA rechazó el comprobante', details: result.arca.messages, invoice: result.invoice });
    }
    res.json({ message: 'Comprobante autorizado por ARCA', invoice: result.invoice, arca: { cae: result.arca.cae, caeVto: result.arca.caeVto, messages: result.arca.messages } });
  } catch (error) {
    if (error && !error.httpStatus) {
      const msg = String(error.message || error);
      if (msg.startsWith('WSAA:') || msg.startsWith('WSFE:') || msg.includes('ARCA')) {
        return res.status(502).json({ error: msg });
      }
    }
    sendError(res, error, 'Error al autorizar comprobante en ARCA');
  }
}

module.exports = {
  getNextNumber,
  getAll,
  getOne,
  create,
  update,
  issue,
  voidInvoice,
  remove,
  preloadProduct,
  preloadRepair,
  getPdf,
  authorizeArca,
  getFiscalIssuer,
};
