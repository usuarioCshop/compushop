# Rotación de la password de Neon (`neondb_owner`)

Motivo: la password del rol `neondb_owner` quedó en texto plano en
`backend/.env.example`, trackeado y pusheado a un repositorio **público**
(`origin/main` y `origin/dev2`, desde el commit `1b54985`). Se corrigió el
archivo (commit `d22e6a7`) pero el secreto sigue en el historial de Git y, por
lo tanto, debe considerarse comprometido.

Purgar el historial **no** vuelve secreta una credencial ya expuesta: sólo rotar
la cierra. Este documento describe la rotación; el historial se limpia después.

## Estado (2026-11-03)

- Password de `production` rotada y verificada: la vieja ya **no autentica** y la
  nueva conecta por unpooled y pooled.
- Password de `test` rotada y verificada: la suite paso 24/24.
- `backend/.env` actualizado con ambas.
- **Pendiente:** variables de entorno en Vercel + redeploy.
- **Pendiente:** purgar el historial de Git.

## Paso 1 — Rotar en Neon (manual, requiere tu login)

1. Entrar a <https://console.neon.tech> → proyecto `rapid-brook-52346436`
   (`org-aged-leaf-24279758`).
2. **Roles** → `neondb_owner` → **Reset password**.
3. Copiar la password nueva. Neon la muestra una sola vez.

Anotar también, para cada branch que usemos, la cadena de conexión:

- `production` → endpoint `ep-long-leaf-b6myr4fz` (pooled y unpooled)
- `test` → endpoint `ep-odd-tree-b6vi1fsh`

**Trampa encontrada en la primera rotacion:** se reseteo la password estando
parado en el branch `test`, y `production` siguio aceptando la credencial vieja.
Hay que seleccionar explicitamente el branch `production` en el dashboard antes
de tocar el rol. La unica prueba valida es intentar conectar con la password
vieja contra `production`: tiene que ser rechazada.

## Paso 2 — Actualizar las variables locales (`backend/.env`, no versionado)

Las tres líneas de conexión, con la password nueva:

```txt
DATABASE_URL="postgresql://neondb_owner:<NUEVA>@ep-long-leaf-b6myr4fz-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:<NUEVA>@ep-long-leaf-b6myr4fz.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require"
TEST_DATABASE_URL="postgresql://neondb_owner:<NUEVA>@ep-odd-tree-b6vi1fsh.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require"
```

## Paso 3 — Actualizar Vercel

Las variables de entorno del backend en Vercel (`DATABASE_URL`,
`DATABASE_URL_UNPOOLED` si está configurada) usan la misma credencial. Después de
cambiarlas hay que **redeployar** para que las functions tomen el valor nuevo.

## Paso 4 — Verificar que nada quedó apuntando a la vieja

```bash
cd backend
npm run migrate:status   # debe responder sin error de autenticación
npm test                 # 24/24 contra el branch de test
```

Si `migrate:status` falla con `password authentication failed`, quedó una URL sin
actualizar.

## Paso 5 — Limpiar el historial (después de rotar)

La credencial vieja ya no autentica, asi que esto pasa de urgente a higiene: que
el historial no le siga ensenando credenciales a quien clone el repo. Se hace con
`git filter-repo` sobre `backend/.env.example` y requiere force-push coordinado
en `main` y `dev2`.

Contexto: el repo es **publico**, y la credencial estuvo expuesta desde `1b54985`
hasta `d22e6a7`. Debe asumirse que fue copiada.

## Notas

- **Los roles de Neon son por branch, no por proyecto.** La rotación lo probó en
  los dos sentidos: el reset hecho parado en el branch `test` no cambió la
  password de `production` (la vieja seguía autenticando hasta que se rotó ahí
  también), y la password nueva de `test` es rechazada contra `production`.
  Cada branch tiene su propio `neondb_owner` con password propia. Por lo tanto,
  un `TRUNCATE` ejecutado contra el branch de test no alcanza los datos de
  producción: el aislamiento ya lo da la arquitectura de Neon, no hace falta un
  rol "dedicado" adicional. Lo que sí importa: (1) el branch de test debe
  haberse creado de forma limpia (sin copia de datos reales de producción);
  (2) al rotar, hay que estar parado en el branch correcto y verificarlo
  conectando, no confiando en el cartel del dashboard.
- El CI (`.github/workflows/ci.yml`) usa un Postgres efímero en `localhost`, no
  Neon: la rotación no lo afecta.
