-- Campos para facturación electrónica ARCA (homologación/producción)
-- Extiende comprobantes internos con datos fiscales electrónicos.

ALTER TABLE billing_clients
  ADD COLUMN IF NOT EXISTS doc_tipo INTEGER, -- 80 CUIT, 96 DNI, 99 CF
  ADD COLUMN IF NOT EXISTS condicion_iva_id INTEGER; -- AFIP CondicionIVAReceptorId

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pto_vta INTEGER,
  ADD COLUMN IF NOT EXISTS cbte_tipo INTEGER, -- 1 Factura A, 6 Factura B
  ADD COLUMN IF NOT EXISTS cbte_numero INTEGER,
  ADD COLUMN IF NOT EXISTS cbte_fecha DATE,
  ADD COLUMN IF NOT EXISTS concepto INTEGER DEFAULT 1, -- 1 productos, 2 servicios, 3 ambos
  ADD COLUMN IF NOT EXISTS receptor_doc_tipo INTEGER,
  ADD COLUMN IF NOT EXISTS receptor_doc_nro TEXT,
  ADD COLUMN IF NOT EXISTS receptor_condicion_iva_id INTEGER,
  ADD COLUMN IF NOT EXISTS receptor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS receptor_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS arca_status TEXT CHECK (arca_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS arca_cae TEXT,
  ADD COLUMN IF NOT EXISTS arca_cae_vto DATE,
  ADD COLUMN IF NOT EXISTS arca_result JSONB,
  ADD COLUMN IF NOT EXISTS arca_errors TEXT,
  ADD COLUMN IF NOT EXISTS arca_observations JSONB,
  ADD COLUMN IF NOT EXISTS fiscal_totals JSONB;

CREATE INDEX IF NOT EXISTS invoices_arca_status_idx ON invoices (arca_status);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_arca_cbte_uq
  ON invoices (pto_vta, cbte_tipo, cbte_numero)
  WHERE cbte_numero IS NOT NULL AND arca_status IS DISTINCT FROM 'rejected';
