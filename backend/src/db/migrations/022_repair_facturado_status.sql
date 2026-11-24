-- 022_repair_facturado_status.sql
-- Agrega estado "facturado" para reparaciones y guarda el estado previo
-- para poder restaurarlo al anular la factura vinculada.

INSERT INTO repair_catalog_items (type, name)
VALUES ('status', 'facturado')
ON CONFLICT (type, name) DO NOTHING;

ALTER TABLE technical_repairs
  ADD COLUMN IF NOT EXISTS status_before_invoice text;
