# Servicio Técnico — órdenes de reparación

Objetivo: sección de servicio técnico accesible solo por el rol `tecnico`, con interfaz tipo gestión de boletas de reparación (boleta, cliente, artículo, daño reportado, imagen, fecha probable de reparación, listado de boletas). Rama `feature-ser-tec` desde `dev2`. Test runner: backend (supertest/jest si existe, de lo contrario curl contra `localhost:4000`) + frontend (vite en `localhost:5173`).

## Specs
- S1: Rol `tecnico` disponible en `users.role` (actualizar CHECK de `admin|customer` a `admin|customer|tecnico`).
- S2: Tabla `technical_repairs` con: `ticket_number`, `status` (pendiente/en_proceso/reparado/entregado/cancelado), `received_at`, `client_name`, `client_address`, `client_id`, `client_email`, `client_phone`, `article`, `brand`, `model`, `serial_number`, `damage_reported`, `notes`, `image_url`, `probable_repair_date`, `created_at`, `updated_at`.
- S3: Endpoint `GET /api/technical-repairs` (listar, solo técnico/admin).
- S4: Endpoint `POST /api/technical-repairs` (crear, solo técnico/admin).
- S5: Endpoints `GET/PUT/DELETE /api/technical-repairs/:id` (solo técnico/admin).
- S6: Endpoint `POST /api/upload/repair-image` (subir imagen del equipo, solo técnico/admin).
- S7: Middleware `requireTecnico` que proteja las rutas de técnico.
- S8: Frontend página `/tecnico` con interfaz similar a la imagen de referencia, protegida por rol `tecnico` (y admin para supervisión).
- S9: `AuthContext` expone `isTecnico`.

- S10: Migración 010: tabla `repair_catalog_items` (`type` en `article|brand|status`, `name`, `is_active`, único por `type+name`) con seed inicial; tabla `repair_clients` (`name`, `address`, `dni`, `email`, `phone`, `created_at`, `updated_at`); columna `assigned_to` en `technical_repairs` (FK a `users`, `SET NULL`); quitar el CHECK de `technical_repairs.status` para permitir estados del catálogo.
- S11: Endpoints `GET /api/repair-catalogs/:type` y `POST /api/repair-catalogs/:type` (solo técnico/admin) para listar y agregar ítems de catálogo.
- S12: Endpoints `GET /api/repair-clients?search=` (busca por nombre, DNI, email o teléfono) y `POST /api/repair-clients` (solo técnico/admin).
- S13: Endpoint `GET /api/technical-repairs/next-ticket` que devuelve el próximo Nº de boleta.
- S14: Validación con zod en creación/edición de reparación; filtros de fecha (`received_from`, `received_to`, `probable_from`, `probable_to`) y ordenamiento (`sort_by`, `sort_dir`); persistir `assigned_to`.
- S15: Endpoint `GET /api/technical-repairs/export` que devuelve CSV del listado filtrado.
- S16: Frontend reemplaza `alert` por toasts de Chakra y valida el formulario antes de enviar.
- S17: Campos Artículo, Marca y Estado son `Select` con botón (+) para agregar ítems al catálogo.
- S18: Lupa junto al input Cliente abre modal de búsqueda; si no se encuentra, permite cargar y guardar el cliente; al cerrar el modal (encontrado o guardado) carga los datos en la orden.
- S19: Al iniciar una nueva orden, el Nº de boleta se precarga con el próximo número antes de guardar.
- S20: Click en una fila abre la vista de detalle de la boleta.
- S21: Filtros de fecha en la UI y ordenamiento visual por columnas.
- S22: Selector de técnico asignado en el formulario.

## Tasks
- T1 | S1,S2 | inline | migración 009 (`users.role` + `technical_repairs`) | completada
- T2 | S7 | inline | middleware `requireTecnico` | completado
- T3 | S3,S4,S5,S6 | inline | rutas backend `/api/technical-repairs` y `/api/upload/repair-image` | completadas
- T4 | S3-S6 | inline | controlador `technicalRepairsController` | completado
- T5 | S9 | inline | `AuthContext.isTecnico` | completado
- T6 | S8 | inline | frontend página `/tecnico` (listado + formulario) | completado
- T7 | S8 | inline | registro de rutas en `App.jsx` y enlace en Navbar | completado
- T8 | S1-S9 | inline | verificación en test (crear/listar/editar reparación con imagen) | completado

- T9 | S10 | inline | migración 010 (catálogos, clientes, `assigned_to`, status sin CHECK) | completada · verificada OK
- T10 | S11 | inline | controlador y rutas de catálogos | completada · verificada OK
- T11 | S12 | inline | controlador y rutas de clientes | completada · verificada OK
- T12 | S13 | inline | endpoint próximo Nº de boleta | completada · verificada OK
- T13 | S14 | inline | validación zod + filtros/orden + `assigned_to` | completada · verificada OK
- T14 | S15 | inline | export CSV | pendiente
- T15 | S16 | inline | toasts + validación frontend | pendiente
- T16 | S17 | inline | selects con (+) para artículo/marca/estado | pendiente
- T17 | S18 | inline | modal búsqueda/creación de cliente | pendiente
- T18 | S19 | inline | precarga de Nº de boleta | pendiente
- T19 | S20 | inline | vista de detalle de boleta | pendiente
- T20 | S21 | inline | filtros de fecha + orden visual | pendiente
- T21 | S22 | inline | selector de técnico asignado | pendiente
- T22 | S10-S22 | inline | verificación integral en test | pendiente

## Log
- L1 (2026-11-10): Usuario solicita sección de servicio técnico solo para rol Técnico, interfaz tipo gestión de boletas de reparación (imagen de referencia). Rama `feature-ser-tec` creada desde `dev2`.

- L2 (2026-11-10): Backend de servicio técnico funcionando (migración 009, middleware requireTecnico, rutas y controlador). Endpoints probados con rol tecnico: create/list OK.

- L3 (2026-11-10): Frontend de servicio técnico completo y funcional. Página `/tecnico` protegida por rol `tecnico` (y admin), AuthContext con `isTecnico`, enlace en Navbar, rutas en App.jsx, listado de boletas y formulario de alta/edición con upload de imagen. Backend y frontend verificados OK en localhost.

- L4 (2026-11-10): Feature de servicio técnico completa y verificada. T1-T8 cerradas en `feature-ser-tec`. Pendiente: push/merge (usuario).

- L5 (2026-11-11): Se crearon 4 usuarios de prueba (uno por rol) con contraseña común `Compushop2026`: superadmin, admin, tecnico, customer. Se corrigieron iconos de react-icons inexistentes (`FiFileImage` → `FiImage`, `FiClipboardList` → `FiClipboard`, `FiTools` → `FiBriefcase`). Backend y frontend verificados OK en localhost.

- L6 (2026-11-11): Usuario aprueba el esqueleto y pide: «El esqueleto esta ok te paso mi lista,  cargar el campo de orden con el nro que le corresponde antes de guardar, para los campos articulo, marca y estado agregar un boton (+) al lado para incorporar nuevos items para los y cambiar de input a select, una lupa al lado del input de cliente para realizar busquedas y en caso de no encontrarse permiter rellenar los datos y guardarlos todo en un modal y al cerrar el modal ya sea porque se guardo o se encontro cargar los datos en la orden, ya con eso creo que tenemos para un rato». Decisiones de fase 2: catálogos en `repair_catalog_items`; clientes en `repair_clients`; estados pasan a ser catálogo (se quita el CHECK); `assigned_to` como FK a `users`.

- L7 (2026-11-11): Lista de tareas de la fase 2 (T9-T22) integrada en este documento. Pendiente: confirmación de arranque por bloque.

- L8 (2026-11-11): T9-T12 implementadas y verificadas OK contra la base de test. Migración 010 aplicada: `assigned_to` presente, sin CHECK de status, catálogos `article` (7), `brand` (6) y `status` (5), tabla `repair_clients` operativa. GET/POST `/api/repair-catalogs/:type` (201 al crear, 409 en duplicado), GET/POST `/api/repair-clients` con búsqueda, `next-ticket` = `CS261111-0001`, y 403 con rol `customer`. Pendientes: T13-T22.

- L9 (2026-11-11): T13 implementada y verificada OK. Validación zod en alta/edición (`client_name`, `damage_reported`, email, fechas, `assigned_to`), estado validado contra `repair_catalog_items` (se acepta un estado nuevo del catálogo, ej. `listo`; uno inexistente devuelve 400), filtros `received_from/to` y `probable_from/to`, orden por columna (`sort_by`/`sort_dir`), `assigned_to` persistido y `assigned_to_name` en listado/detalle, endpoint `GET /api/technical-repairs/technicians`, 404 en id inexistente y 400 en id inválido. Se corrigió el middleware `validate` (usaba `schema.body` en vez de `schema.shape.body`, por lo que no validaba nada) y la asignación de `req.query` en Express 4. Verificado con curl: 201 con `assigned_to=7` y estado `listo`, 400 en estado/técnico/email/damage inválidos, 200 al desasignar, login validado. Pendientes: T14-T22.
