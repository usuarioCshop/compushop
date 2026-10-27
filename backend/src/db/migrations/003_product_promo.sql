-- Agrega flag de promocion a productos. Los productos en promocion
-- se priorizan en el listado de /productos.

ALTER TABLE products
  ADD COLUMN is_promo boolean NOT NULL DEFAULT false;

CREATE INDEX products_promo_active_idx ON products (is_promo, is_active);
