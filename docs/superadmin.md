# Rol SuperAdmin

La app tiene tres roles: `customer`, `admin` y `superadmin` (desde la migración
`007_superadmin.sql`).

## Qué puede hacer el SuperAdmin

- Todo lo que puede hacer un `admin` (catálogo, pedidos, usuarios, settings...).
- Crear cuentas `admin` o `customer` vía API (`POST /api/users`) o desde la
  pantalla **Administración → Usuarios → Crear usuario** (visible solo para
  superadmin).
- Ascender/degradar roles y eliminar cuentas admin.

Las cuentas admin/superadmin solo puede tocarlas el superadmin. Un `admin` no
puede crear admins ni cambiar roles. El propio superadmin no puede cambiar su
propio rol a través del panel.

## Crear o resetear la cuenta superadmin (bootstrap y recuperación)

El superadmin es un usuario real en la base (login normal JWT + bcrypt). La
contraseña se setea desde el entorno, nunca se versiona:

```bash
cd backend
SUPERADMIN_EMAIL=super@compushop.com SUPERADMIN_PASSWORD='una-clave-larga-y-unica' npm run create-superadmin
```

- Si el email ya existe: resetea su contraseña y lo promueve a `superadmin`.
- Si no existe: crea el usuario.
- Requiere contraseña de al menos 12 caracteres.

Usos:

1. Inicializar la cuenta hoy (una vez aplicada la migración 007).
2. Recuperar el acceso si se olvida la contraseña: setear las variables y correr
   el script otra vez.

## Reglas de la API

- `POST /api/users` — SuperAdmin. Crea `admin` o `customer` (nunca `superadmin`).
- `PUT /api/users/:id` — Admin o SuperAdmin; pero las cuentas admin/superadmin y
  los cambios de rol exigen ser superadmin.
- `DELETE /api/users/:id` — Admin o SuperAdmin; pero borrar una cuenta
  admin/superadmin exige ser superadmin. Un superadmin no puede autoeliminarse.

## Dónde se aplica la migración 007

La migración vive en `src/db/migrations/` y la aplica `npm run migrate` contra
`DATABASE_URL_UNPOOLED`. Hoy está aplicada solo en el branch Neon de test; aplicar
en producción requiere autorización del responsable (comandos:
`cd backend && npm run migrate:status && npm run migrate`).

## Nota de seguridad

Las credenciales por defecto del seed (`admin@compushop.com / admin123`,
`cliente123`) son públicas. Crear el superadmin, cambiar esas claves y rotar
`JWT_SECRET`. El fallback `compushop_secret` del código debe eliminarse para
producción (pendiente).
