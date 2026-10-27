-- Campo para calculo de precio de venta
ALTER TABLE products
  ADD COLUMN ingreso_bruto numeric(12,2) DEFAULT 0 CHECK (ingreso_bruto >= 0);
