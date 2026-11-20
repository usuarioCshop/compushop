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

function todayYmd() {
  // fecha local del servidor en formato YYYY-MM-DD
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toYmd(value) {
  if (!value) return todayYmd();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayYmd();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function findSessionForDate(txOrDb, dateYmd, { onlyOpen = false } = {}) {
  const runner = txOrDb || db;
  const session = await runner.prepare('SELECT * FROM cash_sessions WHERE session_date = $1').get(dateYmd);
  if (!session) return null;
  if (onlyOpen && session.status !== 'abierta') return null;
  return session;
}

async function getOpenSession(txOrDb) {
  const runner = txOrDb || db;
  return runner.prepare("SELECT * FROM cash_sessions WHERE status = 'abierta' ORDER BY session_date DESC, id DESC LIMIT 1").get();
}

function isStaleOpenSession(session) {
  if (!session || session.status !== 'abierta') return false;
  return String(session.session_date || '').slice(0, 10) < todayYmd();
}

async function assertNoStaleOpenSession(txOrDb) {
  const open = await getOpenSession(txOrDb);
  if (isStaleOpenSession(open)) {
    throw httpError(409, `Hay una sesión de caja abierta del día ${String(open.session_date).slice(0, 10)}. Debés cerrarla antes de realizar movimientos.`);
  }
  return open;
}

async function computeSessionCashState(txOrDb, session) {
  if (!session || !session.id) return null;
  const runner = txOrDb || db;

  // Sesión cerrada: usar snapshot/valores guardados para no recalcular retroactivamente
  if (session.status === 'cerrada') {
    const snap = session.totals_snapshot && typeof session.totals_snapshot === 'object'
      ? session.totals_snapshot
      : (typeof session.totals_snapshot === 'string' ? (() => { try { return JSON.parse(session.totals_snapshot); } catch { return {}; } })() : {});
    return {
      opening_balance: round2(session.opening_balance),
      ingresos_efectivo: round2(snap.ingresos_efectivo ?? 0),
      egresos_efectivo: round2(snap.egresos_efectivo ?? 0),
      ingresos_cobrados: round2(snap.ingresos_cobrados ?? 0),
      ingresos_pendientes: round2(snap.ingresos_pendientes ?? 0),
      egresos_total: round2(snap.egresos_total ?? 0),
      expected_cash: round2(session.expected_cash ?? snap.expected_cash ?? session.opening_balance),
      counted_cash: session.counted_cash != null ? round2(session.counted_cash) : (snap.counted_cash != null ? round2(snap.counted_cash) : null),
      difference: session.difference != null ? round2(session.difference) : (snap.difference != null ? round2(snap.difference) : null),
    };
  }

  const sums = await runner.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN movement_type='ingreso' AND status='cobrado' AND payment_method='efectivo' THEN amount ELSE 0 END),0) AS ingresos_efectivo,
      COALESCE(SUM(CASE WHEN movement_type='egreso' AND status='registrado' AND payment_method='efectivo' THEN amount ELSE 0 END),0) AS egresos_efectivo,
      COALESCE(SUM(CASE WHEN movement_type='ingreso' AND status='cobrado' THEN amount ELSE 0 END),0) AS ingresos_cobrados,
      COALESCE(SUM(CASE WHEN movement_type='ingreso' AND status IN ('pendiente_verificacion','pendiente_cobro') THEN amount ELSE 0 END),0) AS ingresos_pendientes,
      COALESCE(SUM(CASE WHEN movement_type='egreso' AND status='registrado' THEN amount ELSE 0 END),0) AS egresos_total
    FROM cash_movements
    WHERE status <> 'anulado'
      AND (cash_session_id = $1 OR (cash_session_id IS NULL AND movement_date = $2::date))
  `).get(session.id, session.session_date);

  const opening = round2(session.opening_balance);
  const ingresosEfectivo = round2(sums.ingresos_efectivo);
  const egresosEfectivo = round2(sums.egresos_efectivo);
  const expectedCash = round2(opening + ingresosEfectivo - egresosEfectivo);
  return {
    opening_balance: opening,
    ingresos_efectivo: ingresosEfectivo,
    egresos_efectivo: egresosEfectivo,
    ingresos_cobrados: round2(sums.ingresos_cobrados),
    ingresos_pendientes: round2(sums.ingresos_pendientes),
    egresos_total: round2(sums.egresos_total),
    expected_cash: expectedCash,
  };
}

function movementStatusForIncome(paymentMethod) {
  if (paymentMethod === 'efectivo') return 'cobrado';
  if (paymentMethod === 'transferencia') return 'pendiente_verificacion';
  if (paymentMethod === 'cuenta_corriente') return 'pendiente_cobro';
  return 'cobrado';
}

function normalizeAccreditedAt(status, paymentMethod, provided) {
  if (status === 'cobrado' && paymentMethod === 'efectivo') return provided || null;
  if (status === 'cobrado' && (paymentMethod === 'transferencia' || paymentMethod === 'cuenta_corriente')) {
    return provided || new Date().toISOString();
  }
  return null;
}

async function getActiveIncomeMovementByOrigin(txOrDb, originType, originId) {
  const runner = txOrDb || db;
  return runner.prepare(`
    SELECT * FROM cash_movements
    WHERE movement_type = 'ingreso' AND origin_type = $1 AND origin_id = $2 AND status <> 'anulado'
    ORDER BY id DESC LIMIT 1
  `).get(originType, originId);
}

async function createIncomeMovement(txOrDb, data, { allowDuplicate = false } = {}) {
  const runner = txOrDb || db;
  const {
    origin_type,
    origin_id = null,
    amount,
    payment_method,
    description,
    movement_date,
    created_by = null,
    category_id = null,
    reference = null,
    counterparty = null,
    notes = null,
    metadata = null,
    force_status = null,
  } = data;

  if (!['factura', 'pedido', 'reparacion', 'otro'].includes(origin_type)) {
    throw httpError(400, 'Origen de ingreso inválido');
  }
  if (!['efectivo', 'transferencia', 'cuenta_corriente'].includes(payment_method)) {
    throw httpError(400, 'Medio de pago inválido');
  }
  const amt = round2(amount);
  if (!(amt > 0)) return null; // sin monto, no generar movimiento

  if (!allowDuplicate && ['factura', 'pedido', 'reparacion'].includes(origin_type) && origin_id != null) {
    const existing = await getActiveIncomeMovementByOrigin(runner, origin_type, origin_id);
    if (existing) return existing;
  }

  await assertNoStaleOpenSession(runner);

  const status = force_status || movementStatusForIncome(payment_method);
  const mDate = toYmd(movement_date);
  // No asociar movimientos nuevos a sesiones cerradas (evita afectar cierres ya realizados)
  const session = await findSessionForDate(runner, mDate, { onlyOpen: true });
  const accredited_at = normalizeAccreditedAt(status, payment_method, data.accredited_at || null);

  const inserted = await runner.prepare(`
    INSERT INTO cash_movements (
      movement_type, origin_type, origin_id, cash_session_id, movement_date, amount, status,
      payment_method, description, category_id, reference, counterparty, notes,
      accredited_at, accredited_by, created_by, metadata
    ) VALUES (
      'ingreso', $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16
    )
    ON CONFLICT (origin_type, origin_id)
      WHERE movement_type = 'ingreso' AND origin_type IN ('factura','pedido','reparacion') AND status <> 'anulado'
    DO NOTHING
    RETURNING *
  `).run(
    origin_type,
    origin_id,
    session ? session.id : null,
    mDate,
    amt,
    status,
    payment_method,
    description,
    category_id,
    reference,
    counterparty,
    notes,
    accredited_at,
    status === 'cobrado' && accredited_at ? (created_by || null) : null,
    created_by,
    metadata ? JSON.stringify(metadata) : null
  );

  if (inserted.rows && inserted.rows[0]) return inserted.rows[0];
  if (!allowDuplicate && ['factura', 'pedido', 'reparacion'].includes(origin_type) && origin_id != null) {
    return getActiveIncomeMovementByOrigin(runner, origin_type, origin_id);
  }
  return null;
}

async function voidMovementByOrigin(txOrDb, originType, originId, { reason = null, voided_by = null } = {}) {
  const runner = txOrDb || db;
  const existing = await getActiveIncomeMovementByOrigin(runner, originType, originId);
  if (!existing) return null;
  const updated = await runner.prepare(`
    UPDATE cash_movements
    SET status = 'anulado', voided_at = now(), voided_by = $1, void_reason = $2, accredited_at = NULL, accredited_by = NULL
    WHERE id = $3
    RETURNING *
  `).run(voided_by, reason, existing.id);
  return updated.rows ? updated.rows[0] : null;
}

// ===== Integraciones (exportadas) =====

async function syncInvoiceCashMovement(txOrDb, invoice, { created_by = null } = {}) {
  if (!invoice || !invoice.id) return null;
  const status = invoice.status;
  if (status === 'anulada') {
    return voidMovementByOrigin(txOrDb, 'factura', invoice.id, { reason: 'Factura anulada', voided_by: created_by });
  }
  if (status !== 'emitida') return null;
  const paymentMethod = invoice.payment_method;
  if (!paymentMethod) return null; // sin forma de cobro definida, no generar

  // Si la factura incluye ítems de reparación con cobro directo activo, anularlos (evitar duplicado)
  try {
    const items = await (txOrDb || db).prepare(
      `SELECT DISTINCT repair_id FROM invoice_items WHERE invoice_id = $1 AND repair_id IS NOT NULL`
    ).all(invoice.id);
    for (const it of items || []) {
      if (it.repair_id) {
        await voidMovementByOrigin(txOrDb, 'reparacion', it.repair_id, {
          reason: `Reemplazado por factura ${invoice.number || invoice.id}`,
          voided_by: created_by,
        });
      }
    }
  } catch (_) {
    // no bloquear emisión por fallo secundario de reconciliación
  }

  const amount = round2(invoice.total);
  return createIncomeMovement(txOrDb, {
    origin_type: 'factura',
    origin_id: invoice.id,
    amount,
    payment_method: paymentMethod,
    description: `Factura ${invoice.number || invoice.id}`,
    movement_date: toYmd(invoice.issued_at || invoice.created_at || new Date()),
    created_by,
    reference: invoice.number || null,
    metadata: { invoice_id: invoice.id, invoice_status: invoice.status },
  });
}

async function syncOrderCashMovement(txOrDb, order, { created_by = null } = {}) {
  if (!order || !order.id) return null;
  if (order.status === 'cancelled') {
    return voidMovementByOrigin(txOrDb, 'pedido', order.id, { reason: 'Pedido cancelado', voided_by: created_by });
  }
  if (order.status !== 'delivered') return null;
  const pm = order.payment_method;
  if (!['efectivo', 'transferencia'].includes(pm)) return null;
  return createIncomeMovement(txOrDb, {
    origin_type: 'pedido',
    origin_id: order.id,
    amount: round2(order.total),
    payment_method: pm,
    description: `Pedido ${order.order_number || order.id} entregado`,
    movement_date: toYmd(new Date()),
    created_by,
    reference: order.order_number || null,
    metadata: { order_id: order.id, order_status: order.status },
  });
}

async function syncRepairCashMovement(txOrDb, repair, { created_by = null, payment_method = null } = {}) {
  if (!repair || !repair.id) return null;
  if (repair.status !== 'cobrado s/facturacion') {
    // si dejó de estar cobrado s/facturacion, anular movimiento directo activo
    if (['pendiente', 'en_proceso', 'reparado', 'entregado', 'cancelado'].includes(repair.status)) {
      return voidMovementByOrigin(txOrDb, 'reparacion', repair.id, { reason: `Estado de reparación: ${repair.status}`, voided_by: created_by });
    }
    return null;
  }
  const pm = payment_method || repair.cash_payment_method || null;
  if (!['efectivo', 'transferencia'].includes(pm)) {
    throw httpError(400, 'Seleccioná la forma de cobro (efectivo o transferencia) para cobrar sin factura');
  }
  // monto: total reparación (mano de obra + IVA mano de obra + repuestos)
  let amount = 0;
  try {
    const row = await (txOrDb || db).prepare(`
      SELECT
        COALESCE(t.labor_price,0)
        + CASE WHEN t.labor_iva_enabled THEN COALESCE(t.labor_price,0) * COALESCE(t.labor_iva_rate,0) / 100 ELSE 0 END
        + COALESCE((SELECT SUM(quantity * unit_price) FROM repair_parts WHERE repair_id = t.id), 0) AS total
      FROM technical_repairs t WHERE t.id = $1
    `).get(repair.id);
    amount = round2(row?.total || 0);
  } catch (_) {
    amount = 0;
  }
  if (!(amount > 0)) {
    throw httpError(400, 'La reparación no tiene un monto a cobrar');
  }
  return createIncomeMovement(txOrDb, {
    origin_type: 'reparacion',
    origin_id: repair.id,
    amount,
    payment_method: pm,
    description: `Reparación ${repair.ticket_number || repair.id} cobrada sin factura`,
    movement_date: toYmd(new Date()),
    created_by,
    reference: repair.ticket_number || null,
    metadata: { repair_id: repair.id, ticket_number: repair.ticket_number },
  });
}

// ===== HTTP Handlers =====

async function getCurrentSession(req, res) {
  try {
    const open = await getOpenSession();
    const today = todayYmd();
    const todaySession = await findSessionForDate(null, today);
    const session = open || todaySession || null;
    const cash_state = session ? await computeSessionCashState(null, session) : null;
    res.json({ session, open: open || null, today: todaySession || null, cash_state });
  } catch (error) {
    sendError(res, error, 'Error al obtener sesión de caja');
  }
}

async function listSessions(req, res) {
  try {
    const { status, date_from, date_to, limit = 30 } = req.query;
    const params = [];
    const conditions = ['1=1'];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`session_date >= $${params.length}::date`); }
    if (date_to) { params.push(date_to); conditions.push(`session_date <= $${params.length}::date`); }
    params.push(Math.min(parseInt(limit) || 30, 100));
    const sessions = await db.prepare(`
      SELECT s.*,
        uo.name AS opened_by_name, uc.name AS closed_by_name
      FROM cash_sessions s
      LEFT JOIN users uo ON uo.id = s.opened_by
      LEFT JOIN users uc ON uc.id = s.closed_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY session_date DESC, id DESC
      LIMIT $${params.length}
    `).all(...params);
    res.json({ sessions });
  } catch (error) {
    sendError(res, error, 'Error al listar sesiones de caja');
  }
}

async function openSession(req, res) {
  try {
    const body = req.body || {};
    const sessionDate = todayYmd(); // siempre fecha actual
    const openingBalance = round2(body.opening_balance ?? 0);
    const session = await db.transaction(async (tx) => {
      const open = await tx.prepare("SELECT id, session_date FROM cash_sessions WHERE status = 'abierta' FOR UPDATE").get();
      if (open && open.id) {
        if (String(open.session_date || '').slice(0, 10) < sessionDate) {
          throw httpError(409, `Hay una sesión de caja abierta del día ${String(open.session_date).slice(0, 10)}. Debés cerrarla antes de abrir una nueva.`);
        }
        throw httpError(400, 'Ya existe una sesión de caja abierta');
      }
      const existing = await tx.prepare('SELECT * FROM cash_sessions WHERE session_date = $1 FOR UPDATE').get(sessionDate);
      if (existing && existing.id) {
        if (existing.status === 'cerrada') throw httpError(400, 'La sesión de hoy ya está cerrada');
        return existing;
      }
      const inserted = await tx.prepare(`
        INSERT INTO cash_sessions (session_date, status, opening_balance, notes, opened_by, opened_at)
        VALUES ($1, 'abierta', $2, $3, $4, now())
        RETURNING *
      `).run(sessionDate, openingBalance, body.notes || null, req.user?.id || null);
      return inserted.rows[0];
    });
    res.status(201).json({ session });
  } catch (error) {
    sendError(res, error, 'Error al abrir sesión de caja');
  }
}

async function closeSession(req, res) {
  try {
    const rawCounted = req.body?.counted_cash;
    const countedCash = round2(rawCounted);
    if (!Number.isFinite(Number(rawCounted))) {
      throw httpError(400, 'Ingresá un monto válido para el efectivo contado');
    }
    const session = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM cash_sessions WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing || !existing.id) throw httpError(404, 'Sesión no encontrada');
      if (existing.status === 'cerrada') throw httpError(400, 'La sesión ya está cerrada');

      const state = await computeSessionCashState(tx, existing);
      const expectedCash = state.expected_cash;
      const difference = round2(countedCash - expectedCash);
      const snapshot = {
        ...state,
        counted_cash: countedCash,
        difference,
      };

      const updated = await tx.prepare(`
        UPDATE cash_sessions SET
          status = 'cerrada', counted_cash = $1, expected_cash = $2, difference = $3,
          totals_snapshot = $4, notes = $5, closed_by = $6, closed_at = now()
        WHERE id = $7
        RETURNING *
      `).run(countedCash, expectedCash, difference, JSON.stringify(snapshot), req.body?.notes ?? existing.notes, req.user?.id || null, existing.id);
      return updated.rows[0];
    });
    res.json({ session });
  } catch (error) {
    sendError(res, error, 'Error al cerrar sesión de caja');
  }
}

async function listCategories(req, res) {
  try {
    const { include_inactive } = req.query;
    const where = include_inactive === 'true' ? '1=1' : 'is_active = true';
    const categories = await db.prepare(`
      SELECT * FROM cash_categories WHERE ${where} ORDER BY is_default DESC, name ASC
    `).all();
    res.json({ categories });
  } catch (error) {
    sendError(res, error, 'Error al listar categorías');
  }
}

async function createCategory(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    try {
      const inserted = await db.prepare(`
        INSERT INTO cash_categories (name, is_default, created_by)
        VALUES ($1, false, $2)
        RETURNING *
      `).run(name, req.user?.id || null);
      return res.status(201).json({ category: inserted.rows[0] });
    } catch (e) {
      if (db.isUniqueViolation && db.isUniqueViolation(e)) {
        const existing = await db.prepare(`SELECT * FROM cash_categories WHERE lower(btrim(name)) = lower(btrim($1))`).get(name);
        if (existing && !existing.is_active) {
          const upd = await db.prepare(`UPDATE cash_categories SET is_active = true WHERE id = $1 RETURNING *`).run(existing.id);
          return res.status(201).json({ category: upd.rows[0], reactivated: true });
        }
        return res.status(409).json({ error: 'La categoría ya existe', category: existing || null });
      }
      throw e;
    }
  } catch (error) {
    sendError(res, error, 'Error al crear categoría');
  }
}

async function updateCategory(req, res) {
  try {
    const { name, is_active } = req.body || {};
    const existing = await db.prepare('SELECT * FROM cash_categories WHERE id = $1').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });
    try {
      const updated = await db.prepare(`
        UPDATE cash_categories SET
          name = COALESCE($1, name),
          is_active = COALESCE($2, is_active)
        WHERE id = $3
        RETURNING *
      `).run(name !== undefined ? String(name).trim() : null, is_active !== undefined ? is_active : null, req.params.id);
      res.json({ category: updated.rows[0] });
    } catch (e) {
      if (db.isUniqueViolation && db.isUniqueViolation(e)) {
        return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      }
      throw e;
    }
  } catch (error) {
    sendError(res, error, 'Error al actualizar categoría');
  }
}

function buildMovementFilters(query) {
  const conditions = ['1=1'];
  const params = [];
  const { movement_type, status, origin_type, payment_method, category_id, date_from, date_to, session_id, search } = query || {};
  if (movement_type) { params.push(movement_type); conditions.push(`m.movement_type = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`m.status = $${params.length}`); }
  if (origin_type) { params.push(origin_type); conditions.push(`m.origin_type = $${params.length}`); }
  if (payment_method) { params.push(payment_method); conditions.push(`m.payment_method = $${params.length}`); }
  if (category_id) { params.push(category_id); conditions.push(`m.category_id = $${params.length}`); }
  if (session_id) { params.push(session_id); conditions.push(`m.cash_session_id = $${params.length}`); }
  if (date_from) { params.push(date_from); conditions.push(`m.movement_date >= $${params.length}::date`); }
  if (date_to) { params.push(date_to); conditions.push(`m.movement_date <= $${params.length}::date`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(m.description ILIKE $${params.length} OR COALESCE(m.reference,'') ILIKE $${params.length} OR COALESCE(m.counterparty,'') ILIKE $${params.length})`); }
  return { where: conditions.join(' AND '), params };
}

async function listMovements(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query || {};
    const take = Math.min(parseInt(limit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * take;
    const { where, params } = buildMovementFilters(req.query);
    const countRow = await db.prepare(`SELECT COUNT(*)::int AS total FROM cash_movements m WHERE ${where}`).get(...params);
    params.push(take, offset);
    const movements = await db.prepare(`
      SELECT m.*, c.name AS category_name,
             u.name AS created_by_name, ua.name AS accredited_by_name, uv.name AS voided_by_name
      FROM cash_movements m
      LEFT JOIN cash_categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.created_by
      LEFT JOIN users ua ON ua.id = m.accredited_by
      LEFT JOIN users uv ON uv.id = m.voided_by
      WHERE ${where}
      ORDER BY m.movement_date DESC, m.created_at DESC, m.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `).all(...params);
    res.json({
      movements,
      pagination: {
        page: Math.max(parseInt(page) || 1, 1),
        limit: take,
        total: countRow?.total || 0,
        pages: Math.ceil((countRow?.total || 0) / take),
      },
    });
  } catch (error) {
    sendError(res, error, 'Error al listar movimientos de caja');
  }
}

async function createMovement(req, res) {
  try {
    const body = req.body || {};
    const movement = await db.transaction(async (tx) => {
      const mDate = toYmd(body.movement_date);
      const open = await getOpenSession(tx);
      if (!open) {
        throw httpError(400, 'No hay una sesión de caja abierta. Abrí la caja para registrar movimientos manuales.');
      }
      if (isStaleOpenSession(open)) {
        throw httpError(409, `Hay una sesión de caja abierta del día ${String(open.session_date).slice(0, 10)}. Debés cerrarla antes de realizar movimientos.`);
      }
      // Los movimientos manuales se registran en la sesión abierta vigente
      const session = open;

      if (body.movement_type === 'egreso') {
        if (!['efectivo', 'transferencia', 'otro'].includes(body.payment_method)) {
          throw httpError(400, 'Medio de pago de egreso inválido');
        }
        const categoryId = body.category_id ? Number(body.category_id) : null;
        if (!categoryId) throw httpError(400, 'La categoría es obligatoria para egresos');
        const cat = await tx.prepare('SELECT id, is_active FROM cash_categories WHERE id = $1').get(categoryId);
        if (!cat || !cat.id) throw httpError(400, 'Categoría inválida');
        const inserted = await tx.prepare(`
          INSERT INTO cash_movements (
            movement_type, origin_type, origin_id, cash_session_id, movement_date, amount, status,
            payment_method, description, category_id, reference, counterparty, notes, created_by
          ) VALUES ('egreso','egreso_manual',NULL,$1,$2,$3,'registrado',$4,$5,$6,$7,$8,$9,$10)
          RETURNING *
        `).run(
          session.id, mDate, round2(body.amount), body.payment_method,
          String(body.description || '').trim(), categoryId,
          body.reference || null, body.counterparty || null, body.notes || null, req.user?.id || null
        );
        return inserted.rows[0];
      }

      // ingreso manual (otro)
      if (!['efectivo', 'transferencia', 'cuenta_corriente'].includes(body.payment_method)) {
        throw httpError(400, 'Medio de pago de ingreso inválido');
      }
      const status = movementStatusForIncome(body.payment_method);
      const accredited_at = normalizeAccreditedAt(status, body.payment_method, null);
      const inserted = await tx.prepare(`
        INSERT INTO cash_movements (
          movement_type, origin_type, origin_id, cash_session_id, movement_date, amount, status,
          payment_method, description, category_id, reference, counterparty, notes,
          accredited_at, accredited_by, created_by
        ) VALUES ('ingreso','otro',NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `).run(
        session.id, mDate, round2(body.amount), status, body.payment_method,
        String(body.description || '').trim(), body.category_id || null,
        body.reference || null, body.counterparty || null, body.notes || null,
        accredited_at, accredited_at ? (req.user?.id || null) : null, req.user?.id || null
      );
      return inserted.rows[0];
    });
    res.status(201).json({ movement });
  } catch (error) {
    sendError(res, error, 'Error al registrar movimiento');
  }
}

async function updateMovement(req, res) {
  try {
    const movement = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM cash_movements WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing) throw httpError(404, 'Movimiento no encontrado');
      if (existing.movement_type !== 'egreso') throw httpError(400, 'Solo se pueden editar egresos manuales');
      if (existing.origin_type !== 'egreso_manual') throw httpError(400, 'Solo se pueden editar egresos manuales');
      if (existing.status === 'anulado') throw httpError(400, 'No se puede editar un egreso anulado');
      const body = req.body || {};
      let categoryId = existing.category_id;
      if (body.category_id !== undefined) {
        if (body.category_id === null || body.category_id === '') {
          throw httpError(400, 'La categoría es obligatoria para egresos');
        }
        categoryId = Number(body.category_id);
        const cat = await tx.prepare('SELECT id FROM cash_categories WHERE id = $1').get(categoryId);
        if (!cat) throw httpError(400, 'Categoría inválida');
      }
      const paymentMethod = body.payment_method !== undefined ? body.payment_method : existing.payment_method;
      if (!['efectivo', 'transferencia', 'otro'].includes(paymentMethod)) {
        throw httpError(400, 'Medio de pago de egreso inválido');
      }
      const open = await getOpenSession(tx);
      if (!open) {
        throw httpError(400, 'No hay una sesión de caja abierta. Abrí la caja para editar movimientos manuales.');
      }
      if (isStaleOpenSession(open)) {
        throw httpError(409, `Hay una sesión de caja abierta del día ${String(open.session_date).slice(0, 10)}. Debés cerrarla antes de realizar movimientos.`);
      }
      const mDate = body.movement_date ? toYmd(body.movement_date) : toYmd(existing.movement_date);
      const updated = await tx.prepare(`
        UPDATE cash_movements SET
          movement_date = $1,
          amount = $2,
          description = $3,
          payment_method = $4,
          category_id = $5,
          reference = $6,
          counterparty = $7,
          notes = $8,
          cash_session_id = $9
        WHERE id = $10
        RETURNING *
      `).run(
        mDate,
        body.amount !== undefined ? round2(body.amount) : existing.amount,
        body.description !== undefined ? String(body.description).trim() : existing.description,
        paymentMethod,
        categoryId,
        body.reference !== undefined ? (body.reference || null) : existing.reference,
        body.counterparty !== undefined ? (body.counterparty || null) : existing.counterparty,
        body.notes !== undefined ? (body.notes || null) : existing.notes,
        open.id,
        existing.id
      );
      return updated.rows[0];
    });
    res.json({ movement });
  } catch (error) {
    sendError(res, error, 'Error al actualizar movimiento');
  }
}

async function voidMovement(req, res) {
  try {
    const reason = (req.body?.reason || '').trim() || null;
    const movement = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM cash_movements WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing) throw httpError(404, 'Movimiento no encontrado');
      if (existing.status === 'anulado') return existing;
      const updated = await tx.prepare(`
        UPDATE cash_movements
        SET status = 'anulado', voided_at = now(), voided_by = $1, void_reason = $2, accredited_at = NULL, accredited_by = NULL
        WHERE id = $3
        RETURNING *
      `).run(req.user?.id || null, reason, existing.id);
      return updated.rows[0];
    });
    res.json({ movement });
  } catch (error) {
    sendError(res, error, 'Error al anular movimiento');
  }
}

async function deleteMovement(req, res) {
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM cash_movements WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing) throw httpError(404, 'Movimiento no encontrado');
      if (!(existing.movement_type === 'egreso' && existing.origin_type === 'egreso_manual')) {
        throw httpError(400, 'Solo se pueden eliminar egresos manuales; otros movimientos deben anularse');
      }
      await tx.prepare('DELETE FROM cash_movements WHERE id = $1').run(existing.id);
    });
    res.json({ message: 'Movimiento eliminado' });
  } catch (error) {
    sendError(res, error, 'Error al eliminar movimiento');
  }
}

async function confirmMovement(req, res) {
  try {
    const movement = await db.transaction(async (tx) => {
      const existing = await tx.prepare('SELECT * FROM cash_movements WHERE id = $1 FOR UPDATE').get(req.params.id);
      if (!existing) throw httpError(404, 'Movimiento no encontrado');
      if (existing.movement_type !== 'ingreso') throw httpError(400, 'Solo se pueden confirmar ingresos');
      if (!['pendiente_verificacion', 'pendiente_cobro'].includes(existing.status)) {
        throw httpError(400, 'El movimiento no está pendiente de confirmación');
      }
      const accreditedAt = req.body?.accredited_at ? new Date(req.body.accredited_at) : new Date();
      const iso = Number.isNaN(accreditedAt.getTime()) ? new Date().toISOString() : accreditedAt.toISOString();
      const updated = await tx.prepare(`
        UPDATE cash_movements
        SET status = 'cobrado', accredited_at = $1, accredited_by = $2
        WHERE id = $3
        RETURNING *
      `).run(iso, req.user?.id || null, existing.id);
      return updated.rows[0];
    });
    res.json({ movement });
  } catch (error) {
    sendError(res, error, 'Error al confirmar cobro');
  }
}

async function getSummary(req, res) {
  try {
    const { date_from, date_to } = req.query || {};
    const params = [];
    const conditions = ["m.status <> 'anulado'"];
    if (date_from) { params.push(date_from); conditions.push(`m.movement_date >= $${params.length}::date`); }
    if (date_to) { params.push(date_to); conditions.push(`m.movement_date <= $${params.length}::date`); }
    const where = conditions.join(' AND ');
    const row = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='cobrado' THEN m.amount ELSE 0 END),0) AS ingresos_cobrados,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status IN ('pendiente_verificacion','pendiente_cobro') THEN m.amount ELSE 0 END),0) AS ingresos_pendientes,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='pendiente_verificacion' THEN m.amount ELSE 0 END),0) AS pendientes_verificacion,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='pendiente_cobro' THEN m.amount ELSE 0 END),0) AS pendientes_cobro,
        COALESCE(SUM(CASE WHEN m.movement_type='egreso' AND m.status='registrado' THEN m.amount ELSE 0 END),0) AS egresos_total,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='cobrado' AND m.payment_method='efectivo' THEN m.amount ELSE 0 END),0) AS ingresos_cobrados_efectivo,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='cobrado' AND m.payment_method='transferencia' THEN m.amount ELSE 0 END),0) AS ingresos_cobrados_transferencia,
        COALESCE(SUM(CASE WHEN m.movement_type='ingreso' AND m.status='cobrado' AND m.payment_method='cuenta_corriente' THEN m.amount ELSE 0 END),0) AS ingresos_cobrados_cuenta_corriente,
        COALESCE(SUM(CASE WHEN m.movement_type='egreso' AND m.status='registrado' AND m.payment_method='efectivo' THEN m.amount ELSE 0 END),0) AS egresos_efectivo
      FROM cash_movements m
      WHERE ${where}
    `).get(...params);

    const byOrigin = await db.prepare(`
      SELECT m.origin_type,
        COALESCE(SUM(CASE WHEN m.status='cobrado' THEN m.amount ELSE 0 END),0) AS cobrado,
        COALESCE(SUM(CASE WHEN m.status IN ('pendiente_verificacion','pendiente_cobro') THEN m.amount ELSE 0 END),0) AS pendiente
      FROM cash_movements m
      WHERE ${where} AND m.movement_type='ingreso'
      GROUP BY m.origin_type
      ORDER BY m.origin_type
    `).all(...params);

    const ingresosCobrados = round2(row.ingresos_cobrados);
    const egresosTotal = round2(row.egresos_total);

    const open = await getOpenSession();
    const today = todayYmd();
    const todaySession = await findSessionForDate(null, today);
    const cashSession = open || todaySession || null;
    let cash_balance = null;
    if (cashSession) {
      const state = await computeSessionCashState(null, cashSession);
      cash_balance = {
        session_id: cashSession.id,
        session_date: cashSession.session_date,
        session_status: cashSession.status,
        ...state,
      };
    }

    res.json({
      summary: {
        ingresos_cobrados: ingresosCobrados,
        ingresos_pendientes: round2(row.ingresos_pendientes),
        pendientes_verificacion: round2(row.pendientes_verificacion),
        pendientes_cobro: round2(row.pendientes_cobro),
        egresos_total: egresosTotal,
        saldo_neto: round2(ingresosCobrados - egresosTotal),
        ingresos_cobrados_efectivo: round2(row.ingresos_cobrados_efectivo),
        ingresos_cobrados_transferencia: round2(row.ingresos_cobrados_transferencia),
        ingresos_cobrados_cuenta_corriente: round2(row.ingresos_cobrados_cuenta_corriente),
        egresos_efectivo: round2(row.egresos_efectivo),
      },
      by_origin: byOrigin.map((r) => ({ ...r, cobrado: round2(r.cobrado), pendiente: round2(r.pendiente) })),
      cash_balance,
    });
  } catch (error) {
    sendError(res, error, 'Error al obtener resumen de caja');
  }
}

module.exports = {
  // HTTP
  getCurrentSession,
  listSessions,
  openSession,
  closeSession,
  listCategories,
  createCategory,
  updateCategory,
  listMovements,
  createMovement,
  updateMovement,
  voidMovement,
  deleteMovement,
  confirmMovement,
  getSummary,
  // integraciones
  syncInvoiceCashMovement,
  syncOrderCashMovement,
  syncRepairCashMovement,
  createIncomeMovement,
  voidMovementByOrigin,
  movementStatusForIncome,
  // helpers
  getOpenSession,
  isStaleOpenSession,
  assertNoStaleOpenSession,
  todayYmd,
};
