# Compushop — Guía para agentes

Aplicación web (e-commerce) de una casa de computación. Fullstack: **React + Chakra UI** (frontend) y **Node.js + Express** (backend). Todo el producto, la UI y los mensajes están **en español**.

Repo: `https://github.com/usuarioCshop/compushop` — branch `main`.

## Estructura

- `backend/` — API REST (Express). Entry: `src/index.js` (puerto 4000 vía `PORT`).
  - `src/controllers/` — auth, products, services, orders, users, categories, contact, dashboard, settings
  - `src/db/` — `database.js` (capa única de persistencia: **Postgres vía `pg`**), `migrate.js` (runner de migraciones), `migrations/001_init.sql`, `seed.js`
  - `src/middleware/auth.js` — verificación JWT
  - `src/utils/` — `jwt.js`, `email.js` (nodemailer)
  - `src/routes/index.js` — router principal
- `frontend/` — React 18 + Vite + Chakra UI. Entry: `src/main.jsx`.
  - `src/pages/` y `src/pages/admin/`, `src/components/`, `src/context/` (`AuthContext`, `CartContext`), `src/api/client.js` (axios), `src/theme/`
  - Proxy `/api` → backend en `vite.config.js`

## Cómo ejecutar (desarrollo)

Backend:

```bash
cd backend
npm install
npm run migrate      # aplica el esquema de migrations/ (una vez, o lo que quede pendiente)
npm run seed         # carga datos ficticios
npm run dev          # node --watch  ->  http://localhost:4000
npm test             # node --test: persistencia, smoke HTTP, transacciones
```

⚠️ **La app no crea el esquema al arrancar.** Eso lo hacía la vieja sql.js sobre el filesystem efímero de Vercel; en un Postgres real, correr DDL en cada arranque es una fuente de carreras. El esquema se aplica una sola vez con `npm run migrate` (estado: `npm run migrate:status`). Si la base está vacía, el orden es `migrate` y después `seed`.

⚠️ **Los tests necesitan `TEST_DATABASE_URL`.** Sin esa variable toda la suite se saltea y el proceso sale con código 0: un falso verde indistinguible de una suite que pasa. Por eso `test/helpers.js` imprime un banner imposible de pasar por alto y **falla de entrada** si detecta que corre en CI sin esa variable.

Frontend:

```bash
cd frontend
npm install
npm run dev    # vite  ->  http://localhost:5173
```

## Convenciones

- Idioma de UI, comentarios y mensajes: **español**.
- Backend CommonJS (`"type": "commonjs"`); frontend ESM (`"type": "module"`).
- Nunca commitear `.env` (contiene secretos). Usar `.env.example` como plantilla.
- Commits en conventional commits, **sin** atribución de IA.

## Notas

- Persistencia: **Postgres (Neon)** vía `pg`, capa única en `src/db/database.js`. La API conserva la forma que tenía con sql.js (`prepare()` → `run/get/all`, `transaction()`), pero ahora es **asíncrona**: cada operación devuelve una promesa.
  - **Dentro de una transacción hay que usar siempre el runner que entrega `transaction()`**, nunca `db.prepare()`: ese toma otra conexión del pool y la transacción quedaría partida en dos.
  - `DATABASE_URL` es lo que usa la app (pooled). `DATABASE_URL_UNPOOLED` es la conexión directa que usan migraciones y seed; `migrate.js` la toma sola si existe.
  - El esquema vive en `src/db/migrations/001_init.sql` y queda registrado en la tabla `schema_migrations`.
  - `database.js` mapea `numeric` e `int8` a `Number` en la capa de datos, para que precios y conteos vuelvan como números y no como strings (contrato histórico de la API).
- Tests: `npm test` lista los tres archivos de test explícitamente. `node --test` a secas también agarra `test/helpers.js`, que no tiene tests y sólo infla el conteo. Los tests corren contra una base de **test** distinta a la de producción (`TEST_DATABASE_URL`), porque son destructivos.
- ⚠️ **Deploy en Vercel**: el filesystem de las functions sigue siendo efímero, pero ya no importa para la persistencia, que vive en Neon y no en un archivo local. Lo que sí hay que verificar antes de cada deploy es que el entorno tenga `DATABASE_URL` seteada: sin ella `database.js` lanza `Falta DATABASE_URL` y la function no arranca.
- Los `node_modules` de `backend/` y `frontend/` son independientes; no hay workspace en la raíz.
- Deploy: hay configuraciones de Vercel (`vercel.json`) en backend/frontend.
