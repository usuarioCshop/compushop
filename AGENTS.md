# Compushop — Guía para agentes

Aplicación web (e-commerce) de una casa de computación. Fullstack: **React + Chakra UI** (frontend) y **Node.js + Express** (backend). Todo el producto, la UI y los mensajes están **en español**.

Repo: `https://github.com/usuarioCshop/compushop` — branch `main`.

## Estructura

- `backend/` — API REST (Express). Entry: `src/index.js` (puerto 4000 vía `PORT`).
  - `src/controllers/` — auth, products, services, orders, users, categories, contact, dashboard, settings
  - `src/db/` — `database.js` (capa única de persistencia: sql.js sobre SQLite), `seed.js`, `compushop.db` (generada, ignorada por git)
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
npm run seed   # carga datos ficticios en SQLite (ver aviso abajo)
npm run dev    # node --watch  ->  http://localhost:4000
npm test       # node --test: persistencia, smoke HTTP, transacciones
```

⚠️ **Seed y servidor compiten por el archivo**: sql.js mantiene la base en memoria y la reescribe en cada escritura. Si corrés `npm run seed` con el server levantado, el server pisa el `.db` con su copia (vacía o vieja) en la próxima escritura. Regla: **sembrá con el server detenido**, o reiniciá el server después de sembrar. El arranque en local avisa si la base está vacía.

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

- Persistencia: SQLite vía `sql.js` (capa única en `src/db/database.js`; ruta por `DB_PATH` en `.env`, default `./src/db/compushop.db`). No hay binario nativo: la librería corre en WASM, así que sirve en cualquier plataforma sin compilar. `data.json` y `store.js` fueron eliminados.
- ⚠️ **Deploy en Vercel**: el filesystem de las functions es efímero (y de solo lectura fuera de `/tmp`), así que la persistencia en el `.db` no sobrevive entre invocaciones. Para producción hay que usar un DB real (Neon/Supabase/Postgres con un driver como `pg`) o un servicio con volumen; el esquema actual es portable.
- Los `node_modules` de `backend/` y `frontend/` son independientes; no hay workspace en la raíz.
- Deploy: hay configuraciones de Vercel (`vercel.json`) en backend/frontend.
