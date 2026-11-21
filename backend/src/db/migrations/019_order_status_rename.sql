-- 019_order_status_rename.sql
-- Renombra estados de pedido a español y agrega estado "facturado".
-- Mapeo: pending->pendiente, confirmed->confirmado, processing->preparando,
--        shipped->enviado, delivered->cobrado, cancelled->cancelado.
-- "cobrado" mantiene el mismo efecto caja/stock que "delivered".

DO $$
DECLARE
  ck_name text;
BEGIN
  SELECT c.conname INTO ck_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'orders' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%pending%confirmed%';
  IF ck_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', ck_name);
  END IF;
END $$;

UPDATE orders SET status = CASE status
  WHEN 'pending' THEN 'pendiente'
  WHEN 'confirmed' THEN 'confirmado'
  WHEN 'processing' THEN 'preparando'
  WHEN 'shipped' THEN 'enviado'
  WHEN 'delivered' THEN 'cobrado'
  WHEN 'cancelled' THEN 'cancelado'
  ELSE status
END
WHERE status IN ('pending','confirmed','processing','shipped','delivered','cancelled');

ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'confirmado';

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendiente','confirmado','preparando','enviado','cobrado','cancelado','facturado'));
