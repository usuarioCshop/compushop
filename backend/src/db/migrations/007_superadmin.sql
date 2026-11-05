-- Añade el rol 'superadmin' al CHECK de users.role.
-- El SuperAdmin hereda todo lo que puede hacer un Admin (middleware requireAdmin)
-- y ademas puede crear/modificar/eliminar cuentas admin.
BEGIN;

ALTER TABLE users DROP CONSTRAINT users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'customer', 'superadmin'));

COMMIT;
