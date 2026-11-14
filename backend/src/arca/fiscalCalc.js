const { IVA_IDS } = require('../config/arca');

const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

/**
 * Calcula totales fiscales ARCA desde ítems con precio unitario NETO (sin IVA).
 * items: [{ description, qty|quantity, unitPrice|unit_price, ivaRate|vat_rate, discount? }]
 */
function calcFiscalTotals(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Agregá al menos un ítem');
  const groups = new Map();
  let neto = 0;
  const lines = items.map((it) => {
    const description = String(it.description || '').trim();
    const qty = Number(it.qty ?? it.quantity ?? 0);
    const unitPrice = Number(it.unitPrice ?? it.unit_price ?? 0);
    const ivaRate = Number(it.ivaRate ?? it.vat_rate ?? 0);
    const discount = r2(it.discount ?? 0);
    if (!description || !(qty > 0) || !(unitPrice >= 0) || !(ivaRate in IVA_IDS)) {
      throw new Error(`Ítem inválido: ${description || '(sin descripción)'}`);
    }
    const subtotal = r2(qty * unitPrice - discount);
    if (subtotal < 0) throw new Error(`Ítem con importe negativo: ${description}`);
    groups.set(ivaRate, r2((groups.get(ivaRate) || 0) + subtotal));
    neto = r2(neto + subtotal);
    return { description, qty, unitPrice, ivaRate, discount, subtotal };
  });
  const iva = [...groups].map(([rate, base]) => ({
    id: IVA_IDS[rate],
    rate,
    base: r2(base),
    amount: r2(r2(base) * rate / 100),
  }));
  const ivaTotal = r2(iva.reduce((s, a) => s + a.amount, 0));
  return { lines, neto, iva, ivaTotal, total: r2(neto + ivaTotal) };
}

function mapVatRateToId(rate) {
  const id = IVA_IDS[Number(rate)];
  if (!id) throw new Error(`Alícuota IVA no soportada por ARCA: ${rate}`);
  return id;
}

module.exports = { calcFiscalTotals, mapVatRateToId, IVA_IDS };
