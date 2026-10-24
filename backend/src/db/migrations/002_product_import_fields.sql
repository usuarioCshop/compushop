-- Campos que el sistema de gestion externo exporta y que products no guardaba.
--
-- Todos son opcionales a proposito: los productos que ya existen quedan con
-- NULL (o 0 en min_stock) y ninguna consulta actual se rompe, porque nadie los
-- lee todavia salvo la importacion.
--
--   "Precio Compra" -> purchase_price : costo. Distinto de price, que es venta.
--   "StockMinimo"   -> min_stock      : umbral para detectar stock bajo.
--   "AlicuotaIva"   -> vat_rate       : porcentaje de IVA (10.5, 21, ...).
--   "CodigoProv"    -> supplier_code  : codigo del mismo producto en el proveedor.

ALTER TABLE products
  ADD COLUMN purchase_price numeric(12,2) CHECK (purchase_price >= 0),
  ADD COLUMN min_stock      integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  ADD COLUMN vat_rate       numeric(5,2) CHECK (vat_rate >= 0 AND vat_rate <= 100),
  ADD COLUMN supplier_code  text;

-- Buscar por codigo de proveedor es el caso tipico al conciliar una planilla.
CREATE INDEX products_supplier_code_idx ON products (supplier_code);
