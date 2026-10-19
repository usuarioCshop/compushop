# Feature: Unificación de persistencia backend

Objetivo: dejar una sola capa de persistencia para el backend, eliminando la coexistencia de `store.js` y `database.js` sobre el mismo `data.json` (la migración a SQLite está a medias y rompe filtros/listados admin). Incluye pruebas automatizadas mínimas.

Branch: `main` (sin cambios aún). Delivery: `ask-on-risk`. Test runner: Node.js sin framework adicional (scripts con `assert`), ejecutados con `node`.

## Specs

- S1 — Una única fuente de verdad: todas las rutas y controllers leen y escriben la misma instancia persistente; no quedan dos módulos con esquemas distintos sobre `data.json`.
- S2 — El seed regenera `data.json` con el esquema unificado; tras `npm run seed`, productos activos, settings y demás entidades son visibles para los controllers (sin warnings silenciosos).
- S3 — Listados/filtros admin funcionan: `GET /api/products` (con paginación/filtros), `GET /api/products/:id` (por id o slug), categorías con `product_count`, servicios, órdenes, usuarios, mensajes de contacto, dashboard y settings sin resultados vacíos inesperados.
- S4 — Los cambios persisten y se vuelven a leer: crear/actualizar/eliminar producto, categoría y servicio; actualizar estado de orden; marcar mensaje leído; guardar settings.
- S5 — Existe un smoke test automatizado (Node + `assert`) que cubre: carga del seed con conteos esperados, filtro de activos, lookup por id/slug y round-trip de persistencia para al menos un recurso.
- S6 — No quedan referencias ni imports al módulo de persistencia descontinuado en `backend/src`.

Decision adoptada (según preferencia del usuario, 2026-10-15): se consolida en `sql.js`/SQLite. `store.js` y el shim `database.js` quedan descontinuados. Implica reescribir seed y controladores contra la capa SQL (mayor trabajo que la alternativa `store.js`, ahora descartada).

## Tasks

- T1 | S1 | Decision y consolidacion en sql.js/SQLite (reemplaza store.js/database.js) | inline | completado (2026-10-15)
- T2 | S2,S3 | Migrar productsController y categoriesController a sql.js | inline | completado (rutas + controllers unificados)
- T3 | S3,S4 | Migrar servicesController, usersController, ordersController, contactController, settingsController, dashboardController a sql.js | inline | completado (rutas + controllers unificados)
- T4 | S1 | Normalizar settings (key/value SQL) y password_resets en controllers | inline | completado
- T5 | S1,S6 | Unificar imports en routes/index.js y authController; eliminar store.js (database.js queda como capa unica) | inline | completado
- T6 | S5 | Agregar smoke test Node y cablearlo como `npm test` en backend | inline | completado (3/3 pass)
- T7 | S2,S3,S4,S5 | Verificacion final: seed + smoke + smoke HTTP manual | inline | completado (npm test pass; endpoints ok)

## Log

- L1: "correcto crea el archivo para unificacion de persistencia en odd/tasks e incluye tambien test" (pedido original del usuario).
- L2: Analisis del estado inicial: coexistencia de `store.js` y `database.js` sobre el mismo `data.json`, con esquemas incompatibles (is_active boolean vs 1/0; settings objeto vs array de {key,value}). Seed usa store; la mayoria de controllers usa database. Esto provoca listados admin vacios/rotos.
- L4: "prefiero ir todo a sqlite/sql.js" (correccion del usuario, 2026-10-15). Reescribe la decision y reabre T1: capa unica pasa a ser sql.js/SQLite; se descarta store.js y se descontinua tambien el shim database.js.
- L5: T1 completado...
- L6: T2–T5 completados: rutas unificadas a controllers SQL, auth migrado, store.js eliminado, email.js migrado; T6–T7: suite smoke añadida (3/3 pass) y verificación HTTP. `npm test` verde en backend.
- L7: Todo el trabajo estaba sin commitear. Se creó la rama `dev2` y se commitó la migración completa como unidad de trabajo (`ea90a23 refactor(db): unificar persistencia del backend en sql.js/SQLite`). Se eliminó `data.json`: tras la migración ningún código lo referenciaba (solo docs).
- L8: Smoke HTTP automatizado (`9b0e8ad test(backend): automatizar smoke HTTP de la API`): reemplaza la verificación manual con un test que levanta la app real en un puerto efímero y cubre catálogo (id/slug/404), 401 en rutas admin, settings/dashboard con token, CRUD y persistencia en disco (proceso aparte lee el `.db`).
- L9: Arranque con base vacía (`fc79c5c feat(db): avisar al arrancar cuando la base no tiene datos`). **Hallazgo sql.js**: el `Statement` crudo de `sql.js` devuelve un *array* en `.get()`, no un objeto; `isEmpty()` debe usar el wrapper `createStatement` para leer `row.c`. Detectado porque el test del caso vacío pasaba por el motivo equivocado; se agregó test en proceso aparte que atrapa la regresión.
- L10: **Bug real encontrado en la verificación E2E del frontend**: `POST /api/orders` fallaba con `cannot commit - no transaction is active`. Causa: `ordersController.create` hace varias escrituras dentro de `db.transaction()` (orden + items + descuento de stock), y cada escritura pasaba por `createStatement.run()` que llama a `persist()` → `database.export()`, lo que **terminaba la transacción activa**. El `COMMIT` final fallaba y, como el `ROLLBACK` tampoco encontraba transacción, las escrituras parciales quedaban auto-committeadas → pedidos/items/stock a medias y respuesta 400. Arreglado en `e793c47 fix(db): corregir transacciones que no se confirmaban en sql.js` postergando el volcado a disco (`inTransaction` en `persist`) y persistiendo una sola vez al confirmar. Verificado con bisect (deshabilitar el flag reproduce el fallo) y tests de regresión. La DB de desarrollo contaminada por los intentos fallidos se regeneró con `npm run seed`.

## Verificación E2E frontend (2026-10-15, rama dev2)

Con backend (4000) y frontend (5173) levantados, recorrido completo en navegador contra la base SQLite:
- Home, catálogo (12 productos), detalle por id/slug, agregado al carrito (badge + localStorage).
- Login admin; dashboard con datos reales (12 productos, 4 servicios, 1 pedido, ingresos).
- Listados admin: productos (12), servicios (4), pedidos (1), usuarios (2), mensajes (0), configuración (10 campos poblados).
- Filtros de catálogo: búsqueda (`?search=monitor` → 2) y categoría por slug (`?category=monitores` → 2) + combobox.
- Flujo de pedido: crear desde el carrito (201, `CS261015-1837`, stock descontado) y actualizar estado a `shipped` desde pedidos admin (persistido).
- Sin errores de consola. `npm test` en backend: 16/16 pass.

## Evidencia de commits (dev2)

- `ea90a23` refactor(db): unificar persistencia del backend en sql.js/SQLite
- `9b0e8ad` test(backend): automatizar smoke HTTP de la API
- `fc79c5c` feat(db): avisar al arrancar cuando la base no tiene datos
- `e793c47` fix(db): corregir transacciones que no se confirmaban en sql.js
- más `docs:` (AGENTS.md + esta tarea)

## Deuda / pendientes

- **Vercel**: el filesystem de las functions es efímero; el `.db` no sobrevive entre invocaciones. Para producción conviene Postgres real (Neon/Supabase) reutilizando el esquema.