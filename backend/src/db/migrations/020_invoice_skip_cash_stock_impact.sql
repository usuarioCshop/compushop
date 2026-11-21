-- 020_invoice_skip_cash_stock_impact.sql
-- Flag persistido/auditable para facturas que no deben afectar caja ni stock
-- (ej: factura documental de pedido ya cobrado/registrado).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS skip_cash_stock_impact boolean NOT NULL DEFAULT false;
