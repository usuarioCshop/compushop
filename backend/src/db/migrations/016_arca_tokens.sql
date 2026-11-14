-- Cache de Ticket de Acceso WSAA para servicios ARCA (wsfe).
CREATE TABLE IF NOT EXISTS arca_tokens (
  service    TEXT PRIMARY KEY,
  token      TEXT NOT NULL,
  sign       TEXT NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER arca_tokens_set_updated_at BEFORE UPDATE ON arca_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
