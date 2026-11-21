-- 021_invoice_order_id.sql
-- Vincula facturas a pedidos (facturación desde pedido cobrado).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS order_id integer REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_order_id_idx ON invoices(order_id);
