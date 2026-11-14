const PDFDocument = require('pdfkit');
const db = require('../db/database');

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

async function getIssuerSnapshot() {
  const rows = await db.prepare('SELECT key, value FROM settings').all();
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
      const normalized = items.map(normalizeItem);
      const totals = calculateTotals(normalized);
      const issuer = await getIssuerSnapshot();

      // Asegurar número único (ya asignado en borrador; mantenerlo)
      await tx.prepare(`
        UPDATE invoices SET
          status = 'emitida', issued_at = now(), issuer_snapshot = $1,
          subtotal = $2, tax_total = $3, discount_total = $4, total = $5
        WHERE id = $6
      `).run(JSON.stringify(issuer), totals.subtotal, totals.tax_total, totals.discount_total, totals.total, req.params.id);

      // actualizar ítems recalculados
      await tx.prepare('DELETE FROM invoice_items WHERE invoice_id = $1').run(req.params.id);
      const insertItem = tx.prepare(`
        INSERT INTO invoice_items (invoice_id, source_type, product_id, repair_id, description, quantity, unit_price, vat_rate, vat_amount, discount, line_subtotal, line_total, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `);
      for (const it of normalized) {
        await insertItem.run(req.params.id, it.source_type, it.product_id, it.repair_id, it.description, it.quantity, it.unit_price, it.vat_rate, it.vat_amount, it.discount, it.line_subtotal, it.line_total, it.metadata ? (typeof it.metadata === 'string' ? it.metadata : JSON.stringify(it.metadata)) : null);
      }

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
    // Repuestos
    for (const p of parts) {
      items.push(normalizeItem({
        source_type: 'repair',
        repair_id: repair.id,
        product_id: p.product_id,
        description: p.description || p.product_name || 'Repuesto',
        quantity: Number(p.quantity || 1),
        unit_price: Number(p.unit_price || 0),
        vat_rate: Number(p.product_vat_rate || 0),
        metadata: { kind: 'part', ticket_number: repair.ticket_number },
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

    res.json({ items, receiver, repair: { id: repair.id, ticket_number: repair.ticket_number, article: repair.article, brand: repair.brand, model: repair.model } });
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

    const issuer = invoice.issuer_snapshot || {};
    const receiver = invoice.receiver_snapshot || {};
    const items = invoice.items || [];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${invoice.number}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    // Encabezado
    doc.fontSize(18).text('FACTURA DE VENTA', { align: 'right' });
    doc.fontSize(10).text(`Nº ${invoice.number}`, { align: 'right' });
    doc.text(`Estado: ${String(invoice.status).toUpperCase()}`, { align: 'right' });
    doc.text(`Fecha: ${formatDate(invoice.issued_at || invoice.created_at)}`, { align: 'right' });
    doc.moveDown(0.5);

    if (invoice.status !== 'emitida') {
      doc.fontSize(24).fillColor(invoice.status === 'anulada' ? 'red' : 'gray')
        .text(invoice.status === 'anulada' ? 'ANULADA' : 'BORRADOR', 40, 120, { align: 'center', opacity: 0.15 });
      doc.fillColor('black');
    }

    doc.fontSize(11).text('Emisor', { underline: true });
    doc.fontSize(10).text(issuer.razon_social || issuer.nombre_fantasia || '-');
    if (issuer.cuit) doc.text(`CUIT: ${issuer.cuit}`);
    if (issuer.domicilio) doc.text(`Domicilio: ${issuer.domicilio}`);
    if (issuer.condicion_iva) doc.text(`Condición IVA: ${issuer.condicion_iva}`);
    if (issuer.iibb) doc.text(`IIBB: ${issuer.iibb}`);
    if (issuer.inicio_actividades) doc.text(`Inicio actividades: ${issuer.inicio_actividades}`);
    doc.moveDown(0.5);

    doc.fontSize(11).text('Receptor', { underline: true });
    doc.fontSize(10).text(receiver.name || '-');
    if (receiver.doc_number) doc.text(`${receiver.doc_type || 'Doc'}: ${receiver.doc_number}`);
    if (receiver.condicion_iva) doc.text(`Condición IVA: ${receiver.condicion_iva}`);
    if (receiver.address) doc.text(`Domicilio: ${receiver.address}`);
    if (receiver.email) doc.text(`Email: ${receiver.email}`);
    if (receiver.phone) doc.text(`Teléfono: ${receiver.phone}`);
    doc.moveDown();

    // Tabla ítems (simple)
    const startY = doc.y;
    const col = { desc: 40, qty: 280, price: 330, iva: 400, total: 470 };
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Descripción', col.desc, startY, { width: 230 });
    doc.text('Cant.', col.qty, startY, { width: 40, align: 'right' });
    doc.text('P. Unit.', col.price, startY, { width: 60, align: 'right' });
    doc.text('IVA %', col.iva, startY, { width: 50, align: 'right' });
    doc.text('Total', col.total, startY, { width: 70, align: 'right' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9);
    let y = doc.y;
    doc.moveTo(40, y).lineTo(550, y).stroke();
    y += 4;

    for (const it of items) {
      if (y > 720) { doc.addPage(); y = 40; }
      doc.text(String(it.description || ''), col.desc, y, { width: 230 });
      doc.text(String(it.quantity), col.qty, y, { width: 40, align: 'right' });
      doc.text(formatMoneyPdf(it.unit_price), col.price, y, { width: 60, align: 'right' });
      doc.text(`${Number(it.vat_rate || 0)}%`, col.iva, y, { width: 50, align: 'right' });
      doc.text(formatMoneyPdf(it.line_total), col.total, y, { width: 70, align: 'right' });
      y += 16;
      if (it.vat_amount > 0) {
        doc.fontSize(8).fillColor('gray').text(`  IVA: ${formatMoneyPdf(it.vat_amount)}`, col.desc, y - 2);
        doc.fillColor('black').fontSize(9);
      }
    }

    y += 8;
    doc.moveTo(40, y).lineTo(550, y).stroke();
    y += 8;
    const rightX = 400;
    doc.fontSize(10).text(`Subtotal: ${formatMoneyPdf(invoice.subtotal)}`, rightX, y, { align: 'right', width: 140 }); y += 14;
    doc.text(`IVA: ${formatMoneyPdf(invoice.tax_total)}`, rightX, y, { align: 'right', width: 140 }); y += 14;
    if (Number(invoice.discount_total) > 0) {
      doc.text(`Descuento: ${formatMoneyPdf(invoice.discount_total)}`, rightX, y, { align: 'right', width: 140 }); y += 14;
    }
    doc.font('Helvetica-Bold').fontSize(12).text(`TOTAL: ${formatMoneyPdf(invoice.total)}`, rightX, y, { align: 'right', width: 140 });
    doc.font('Helvetica').fontSize(10);

    if (invoice.notes) {
      doc.moveDown(2);
      doc.fontSize(10).text('Notas:', 40, y + 30);
      doc.fontSize(9).text(String(invoice.notes), 40, y + 44, { width: 500 });
    }

    if (invoice.status === 'anulada') {
      doc.moveDown(2);
      doc.fillColor('red').fontSize(10).text(`ANULADA${invoice.void_reason ? ` - Motivo: ${invoice.void_reason}` : ''}`, { align: 'center' });
      doc.fillColor('black');
    }

    doc.end();
  } catch (error) {
    if (!res.headersSent) sendError(res, error, 'Error al generar PDF');
    else console.error(error);
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
};
