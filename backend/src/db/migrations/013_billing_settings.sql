-- Campos fiscales del emisor para facturación (guardados en tabla settings como key/value).
-- No requiere ALTER TABLE; se agregan claves permitidas en controller y UI.
-- Valores por defecto vacíos para que el admin los complete.
INSERT INTO settings (key, value) VALUES
  ('emisor_razon_social', ''),
  ('emisor_nombre_fantasia', ''),
  ('emisor_cuit', ''),
  ('emisor_domicilio', ''),
  ('emisor_condicion_iva', ''),
  ('emisor_iibb', ''),
  ('emisor_inicio_actividades', ''),
  ('emisor_telefono', ''),
  ('emisor_email', ''),
  ('emisor_logo', '')
ON CONFLICT (key) DO NOTHING;
