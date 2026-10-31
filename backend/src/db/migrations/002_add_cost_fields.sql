-- Migración 002: Sincronizar esquema con código
-- Agrega campos de costo, precios, stock mínimo y promoción a products
-- Agrega campos de costo faltantes a services

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS supplier_code text,
  ADD COLUMN IF NOT EXISTS flete numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ganancia numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gasto_variable numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingreso_bruto numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS flete numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ganancia numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gasto_variable numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingreso_bruto numeric(12,2) NOT NULL DEFAULT 0;
