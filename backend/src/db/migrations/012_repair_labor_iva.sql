-- Fase 3b: IVA opcional sobre mano de obra en reparaciones
ALTER TABLE technical_repairs
  ADD COLUMN labor_iva_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN labor_iva_rate NUMERIC(5,2) NOT NULL DEFAULT 21 CHECK (labor_iva_rate >= 0 AND labor_iva_rate <= 100);

COMMENT ON COLUMN technical_repairs.labor_iva_enabled IS 'Si true, se suma IVA de mano de obra al total';
COMMENT ON COLUMN technical_repairs.labor_iva_rate IS 'Porcentaje de IVA aplicado a la mano de obra';
