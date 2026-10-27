-- Campos para calculo de precio de servicios con cotizacion USD
ALTER TABLE services
  ADD COLUMN purchase_price numeric(12,2),
  ADD COLUMN vat_rate numeric(5,2),
  ADD COLUMN flete numeric(12,2) DEFAULT 0 CHECK (flete >= 0),
  ADD COLUMN ganancia numeric(12,2) DEFAULT 0 CHECK (ganancia >= 0),
  ADD COLUMN gasto_variable numeric(12,2) DEFAULT 0 CHECK (gasto_variable >= 0),
  ADD COLUMN ingreso_bruto numeric(12,2) DEFAULT 0 CHECK (ingreso_bruto >= 0);
