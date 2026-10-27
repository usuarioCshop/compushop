-- Campos para calculo de precio en USD/ARS
-- flete, ganancia, gastoVariable (numericos opcionales)

ALTER TABLE products
  ADD COLUMN flete numeric(12,2) DEFAULT 0 CHECK (flete >= 0),
  ADD COLUMN ganancia numeric(12,2) DEFAULT 0 CHECK (ganancia >= 0),
  ADD COLUMN gasto_variable numeric(12,2) DEFAULT 0 CHECK (gasto_variable >= 0);
