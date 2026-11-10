-- Añade información de pago al pedido (forma de pago, comprobante y flag si no se pudo subir).
BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('transferencia', 'efectivo')),
  ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_pending BOOLEAN NOT NULL DEFAULT false;

COMMIT;
