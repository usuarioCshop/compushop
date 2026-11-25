# Caja — mejoras 1 (Bloque 3)

## Header
- Objetivo: implementar módulo de Caja para gestionar ingresos y egresos, con integración a facturación/servicios/pedidos según alcance MVP definido y verificado punto por punto.
- Rama: `caja` (derivada de `origin/dev2`)
- Estrategia de entrega: ask-on-risk (verificación punto por punto con el usuario)
- Runner de tests: node --test backend (destructivo si se corre completo; no ejecutar sin aviso). Frontend: build/vite.

## Specs
- S0 (Punto 0, completado): preparación de rama `caja` desde `origin/dev2`, tracking ODD + espejo Engram, y relevamiento de modelos/flujos existentes (facturación, pedidos, reparaciones, clientes, roles, settings).
- S1 (Punto 1, completado): alcance MVP de Caja acordado (C-A1).
- S2 (Punto 2, completado): ingresos y criterio facturado vs cobrado definidos (C-A2, D-5 mixto).
- S3 (Punto 3, completado): egresos/gastos y categorías definidos (C-A3).
- S4 (Punto 4, completado): cierres de caja en MVP definidos (C-A4, cierre diario con arqueo).
- S5 (Punto 5, completado): diseño consolidado aprobado (C-A5).
- S6 (Punto 6, completado): migraciones/modelo de datos aplicadas y validadas en BD test local (C-B1..C-B3).
- S7 (Punto 7, completado): backend/API (C-C1..C-C5) base implementada y validada en flujo.
- S8 (Punto 8, completado): frontend (C-D1..D-D5) base implementado y validado en flujo.
- S9 (Punto 9, completado/parcial): cierre técnico y validación manual en curso. Sección 1 OK, Sección 2 OK, Sección 3 Caso 1 OK; Caso 2 original sync OK pero usuario solicitó cambios de alcance (S10).
- S10 (Extensión, confirmado por usuario 2026-11-21): Pedidos/facturación. (a) Renombrar estados de pedido: `pending→pendiente`, `confirmed→confirmado`, `processing→preparando`, `shipped→enviado`, `delivered→cobrado`, `cancelled→cancelado`; `cobrado` mantiene el mismo efecto caja/stock que `delivered`. (b) Agregar estado `facturado`; desde `cobrado` se habilita “Facturar” y la factura se genera por flujo normal pero **sin afectar caja ni stock**; al emitirse OK el pedido pasa a `facturado`; en `facturado` se deshabilitan cambios manuales de estado. (c) Opción general en factura “No afectar caja/stock (ya cobrado/registrado)”, persistida/auditable; si viene desde pedido cobrado viene premarcada; emisión/ARCA no descuenta stock ni sincroniza caja; anulación normal de esa factura no repone stock ni toca caja. (d) Anular factura desde pedido `facturado`: pedido pasa a `cancelado`, repone stock. Caja con una sola corrección: sesión original abierta mismo día → anular/corregir movimiento original; sesión original cerrada pero caja abierta válida hoy → egreso automático compensatorio en caja de hoy (concepto `Anulación pedido #X (cobrado el DD/MM/YYYY)`, mismo medio de pago) y marcar movimiento original anulado/compensado; si hoy no hay caja abierta válida → bloquear anulación con aviso “Abrí caja para registrar el egreso compensatorio”.

## Tasks
- [x] T0 (P0) | S0 | inline | Rama `caja` creada desde `origin/dev2`, ODD creado y relevamiento inicial documentado. **Verificado por el usuario.**
- [x] T1 (P1) | S1 | inline | Alcance MVP acordado (C-A1). **Verificado por el usuario:** incluido (módulo admin/superadmin, egresos manuales, ingresos por orígenes, listado de movimientos, resumen por período ARS), excluidos diferidos, permisos y orígenes correctos.
- [x] T2 (P2) | S2 | inline | Ingresos y D-5 definidos (C-A2). **Verificado por el usuario:** mixto (cobrado/pendiente, mostrar pendientes); regla efectivo cobrado inmediato y transferencia pendiente de verificación bancaria (cuenta corriente pendiente hasta registrar pago); tipo/forma de cobro al facturar o al registrar cobro directo; pedidos al `delivered`; reparación sin factura al estado `cobrado s/facturacion` (nuevo); otros cobrados al registrar.
- [x] T3 (P3) | S3 | inline | Egresos/gastos definidos (C-A3). **Verificado por el usuario:** campos y medios de pago OK; categorías predefinidas + `Otros` y posibilidad de agregar nueva categoría desde modal al momento de requerirla; acciones sobre egresos: editar, eliminar y anular.
- [x] T4 (P4) | S4 | inline | Cierres de caja definidos (C-A4). **Verificado por el usuario:** Opción B, cierre simple en MVP con apertura y cierre diario, arqueo de efectivo contado con cálculo de diferencias; resumen por período suficiente.
- [x] T5 (P5) | S5 | inline | Diseño consolidado aprobado por el usuario (C-A5). Base para implementación (Puntos 6–9).
- [x] T6 (P6) | S6 | inline | 6.1 DDL aprobado; 6.2 archivo creado `backend/src/db/migrations/018_caja.sql`; 6.3 aplicada y validada en entorno local / BD test (`018_caja.sql` aplicada, tablas/índices/constraints/semilla categorías 7, `invoices.payment_method`, estado `cobrado s/facturacion` presentes). **Verificado (ejecución y consultas de validación).**
- [x] T7 (P7) | S7 | inline | Backend/API implementado (C-C1..C-C5 base): controlador/validaciones/rutas de caja (sesiones apertura/cierre/listado, categorías, movimientos con filtros, egresos manuales editar/anular/eliminar, confirmación de ingresos pendientes, resumen por período); integración automática de ingresos desde facturas emitidas/anuladas (con `payment_method`), pedidos `delivered`/cancelados y reparaciones `cobrado s/facturacion` (evita duplicado al facturar reparación). Verificación técnica: `node --check` en archivos modificados/creados y `require` OK de módulos/rutas desde `backend/`. Pendiente pruebas funcionales/E2E y ajustes según validación de usuario.
- [x] T8 (P8) | S8 | inline | Frontend Caja implementado (base C-D1..D-D5): nueva página admin `frontend/src/pages/admin/AdminCash.jsx` con Resumen, Movimientos (filtros, confirmación de pendientes, anular/editar/eliminar egresos), Egresos/Categorías y Cierre diario (apertura/cierre/arqueo); ruta `/admin/caja` y navegación en `AdminLayout`. Ajustes de integración UI: Facturación ahora permite seleccionar/enviar `payment_method` (borrador, emitir interna, autorizar ARCA) y muestra forma de cobro; Reparación (tab Reparación) solicita forma de cobro al guardar estado `cobrado s/facturacion`. Build frontend verificado (`vite build` OK). Pendiente validación funcional/E2E por usuario y ajustes finos de UX/datos.
- [x] T9 (P9) | S9 | inline | Cierre técnico realizado (C-E1..C-E3, alcance sin E2E automatizado destructivo): verificación de consistencia backend/frontend (checks de sintaxis, `vite build` OK tras ajustes), revisión de integraciones (factura emitida/anulada/ARCA, pedido delivered/cancelled, reparación cobrado s/facturacion y prevención de duplicado al facturar), y ajuste final en `AdminCash.jsx` para usar fecha local (no UTC) en UI de fechas/sesiones. No se ejecutaron `npm test`/`npm run seed` ni pruebas E2E automatizadas contra BD por ser potencialmente destructivos/sensibles; se deja checklist de validación E2E manual para el usuario. Pendiente validación funcional integral en entorno test/local por usuario.
- [x] T10 (seguimiento) | S9 | inline | Primera tarea para mañana: vista/listado dedicado de ingresos pendientes con confirmación por botón (opción A, solicitada tras validación). **Validado OK por el usuario.**
- [x] T11 (S10) | S10 | inline | Migración 019 + renombre de estados de pedido en BD/backend/frontend; agregado `facturado`; `cobrado` mantiene efecto caja/stock. **Implementado, pendiente validación usuario.**
- [x] T12 (S10) | S10 | inline | Opción general factura “No afectar caja/stock” (flag persistido `skip_cash_stock_impact`, migración 020, UI, emisión/ARCA/void respetan flag). **Implementado, pendiente validación usuario.**
- [x] T13 (S10) | S10 | inline | Flujo facturar desde pedido `cobrado`: precarga factura con `order_id`, flag premarcado, emisión OK pasa pedido a `facturado`, deshabilita cambios manuales en `facturado` (migración 021). **Implementado, pendiente validación usuario.**
- [x] T14 (S10) | S10 | inline | Anular factura desde pedido: endpoint `POST /orders/:id/void-invoice`, pedido a `cancelado`, repone stock, corrección caja misma-sesión/compensatorio/bloqueo. **Validado OK por el usuario.**
- [ ] T15 (S10) | S10 | inline | Validación técnica OK (`node --check`, `vite build`, migraciones 019-021 aplicadas en BD test). Checklist manual Sección 3/T11-T14 pendiente usuario.

## Log
L1 (2026-11-19): inicio Punto 0 (Bloque 3 Caja) a pedido del usuario. Rama `caja` creada desde `origin/dev2` (HEAD `6597f9d`).

**Relevamiento inicial (estado actual):**
- **Facturación (`invoices`, `invoice_items`, ARCA):** comprobantes con `number`, `status` (`borrador|emitida|anulada`), totales/snapshots, `issued_at`/`voided_at`, `created_by`, `billing_client_id`; campos fiscales/ARCA (`pto_vta`, `cbte_tipo/numero/fecha`, `concepto`, receptor fiscal, `arca_status` `pending|approved|rejected`, `cae`, `cae_vto`, `fiscal_totals`). Ítems con origen `product|repair|manual` y vínculo a `product_id`/`repair_id`. **No hay campo/flujo explícito de “cobrado/pagado” ni fecha de cobro** (emitir/autorizar ≠ cobro registrado).
- **Pedidos online (`orders`, `order_items`):** estados `pending|confirmed|processing|shipped|cancelled|delivered`, `total`, datos de cliente; pago con `payment_method` (`transferencia|efectivo`), `payment_receipt_url`, `payment_receipt_pending`. No existe estado explícito “pagado/cobrado” separado de logística/comprobante.
- **Servicio técnico (`technical_repairs`, `repair_parts`):** estados `pendiente|en_proceso|reparado|entregado|cancelado`, `labor_price`/IVA mano de obra, repuestos vinculados a productos. **No hay campos de pago/cobro** en la reparación; puede facturarse vía facturación (ítems de reparación).
- **Clientes:** `billing_clients` (facturación, importables desde servicio/usuarios), `repair_clients`, `users`.
- **Roles/permisos:** `superadmin`, `admin`, `tecnico`, `customer`; middlewares `requireSuperAdmin`, `requireAdmin` (`superadmin|admin`), `requireTecnico` (`tecnico|admin|superadmin`). Acceso a Caja a definir (probable `admin|superadmin`).
- **Settings:** tabla key/value (datos fiscales emisor, etc.). No existen tablas de caja/movimientos/cierres.
- **Admin UI:** `AdminLayout` con Dashboard, Productos, Servicios, Pedidos, Usuarios, Mensajes, Configuración (sin sección Caja).

**Pendiente para avanzar:** verificación del Punto 0 y decisiones de Puntos 1–4 (alcance MVP, ingresos/D-5 facturado vs cobrado, egresos, cierres).

L2 (2026-11-19): Punto 0 verificado por el usuario. Presentada propuesta de Punto 1 (alcance MVP, C-A1) para verificación/ajustes. Formato acordado: en cada punto incluir detalle de lo realizado/propuesto y **qué debe verificar el usuario**.
L3 (2026-11-19): Punto 1 verificado por el usuario (alcance, excluidos, permisos admin/superadmin y orígenes OK). Presentada propuesta de Punto 2 (ingresos por origen y D-5 facturado vs cobrado).
L4 (2026-11-19): Punto 2 (parcial, usuario): D-5=C mixto, mostrar cobros pendientes (OK). Facturas según tipo de pago: efectivo se acredita, transferencia “se tiene en cuenta”, cuenta corriente pendiente hasta registrar pago. Pedidos online: transferencia o efectivo según estado del pedido. Servicios/reparaciones: cobro con o sin factura, en efectivo o transferencia. Otros ingresos: cobrados al registrar. Pendiente precisar: acreditación de transferencia y dónde se define tipo de pago en factura; estado de pedido que dispara registro; detalle de cobro directo en servicio/reparación.
L5 (2026-11-19): Aclaraciones usuario: transferencia en facturas queda registrada para verificación manual en cuentas bancarias (pendiente de acreditación hasta verificar). Pedidos online disparan registro en Caja al pasar a estado `entregado` (`delivered`). Reparaciones: cobro directo sin factura al cambiar a estado `cobrado s/facturacion` (estado nuevo a agregar). Pendiente: tratamiento de efectivo/transferencia al entregar pedido y al cobrar reparación, y dónde/cuándo se define tipo de pago en facturas y cobros directos.
L6 (2026-11-19): Usuario confirma propuesta: en pedidos `delivered`, efectivo se acredita/cobra de inmediato y transferencia queda pendiente de verificación bancaria. Tipo de pago se elige al momento de facturar y la forma de cobro “lo mismo”. Pendiente confirmar explícitamente: en reparación `cobrado s/facturacion` se selecciona forma de cobro y aplica igual (efectivo cobrado, transferencia pendiente de verificación bancaria).
L7 (2026-11-19): Punto 2 verificado por el usuario (último punto confirmado: reparación `cobrado s/facturacion` con selección de forma de cobro, efectivo cobrado y transferencia pendiente de verificación bancaria). Presentada propuesta de Punto 3 (egresos/gastos y categorías).
L8 (2026-11-19): Punto 3 verificado por el usuario: campos y medios de pago correctos; categorías iniciales + `Otros` y permitir agregar nueva categoría desde modal al requerirla; egresos con editar, eliminar y anular. Presentada propuesta de Punto 4 (cierres de caja en MVP).
L9 (2026-11-19): Punto 4 verificado por el usuario: Opción B (cierre simple en MVP), apertura y cierre diario, arqueo de efectivo contado con cálculo de diferencias; resumen por período suficiente. Elaborado diseño consolidado Punto 5 para aprobación.
L10 (2026-11-19): Punto 5 aprobado por el usuario (5.1–5.5). Inicio Punto 6: relevamiento de esquema actual para migraciones y propuesta de migración(es) de Caja para verificación antes de aplicar.
L11 (2026-11-19): Punto 6.1 — relevado runner de migraciones (transaccional, sin BEGIN/COMMIT explícito en archivo recomendado), estados de reparación por catálogo `repair_catalog_items` y ausencia de `payment_method` en `invoices`. Propuesto DDL `018_caja.sql` (tablas caja, semilla categorías, índices/constraints, idempotencia ingresos por origen, `invoices.payment_method`, estado `cobrado s/facturacion`) para revisión; sin crear ni aplicar migraciones.
L12 (2026-11-19): Punto 6.1 aprobado por el usuario (6.1.1–6.1.5). Punto 6.2: creado `backend/src/db/migrations/018_caja.sql` con el DDL aprobado; no aplicada la migración. Pendiente 6.3 con confirmación explícita de entorno/BD.
L13 (2026-11-19): Punto 6.3 autorizado por el usuario (entorno local, BD test). Ejecutado `node src/db/migrate.js` apuntando a `TEST_DATABASE_URL`: aplicada `018_caja.sql` (exit 0). Validación OK: tablas `cash_sessions/cash_categories/cash_movements`, 7 categorías semilla, `invoices.payment_method` (text, nullable), estado catálogo `cobrado s/facturacion`, índices y constraints esperados presentes. Punto 6 completado.

L14 (2026-11-19): Punto 7 (backend/API) implementado en rama `caja` (sin commit). Cambios: `backend/src/controllers/cashController.js` (nuevo), `backend/src/validations/cash.js` (nuevo), rutas `/api/cash/*` en `backend/src/routes/index.js` (admin/superadmin), `KNOWN_TABLES` ampliado en `backend/src/db/database.js`. Facturas: `payment_method` en create/update/issue/authorize y sincronización de movimiento de caja al emitir/anular (`syncInvoiceCashMovement`), con selección requerida al emitir/autorizar. Pedidos: sincronización al pasar a `delivered`/`cancelled` (`syncOrderCashMovement`). Reparaciones: soporte de `payment_method` y sincronización al marcar/quitar `cobrado s/facturacion` en create/update, anulación de movimiento directo al eliminar (`syncRepairCashMovement`/`voidMovementByOrigin`), y prevención de duplicado cuando ya existe ingreso por factura asociada. Endpoints de caja: sesiones (`/cash/session/current`, `/cash/sessions`, abrir/cerrar), categorías (listar/crear/actualizar), movimientos (listar con filtros/paginación, crear ingreso/egreso manual, editar egreso, anular, confirmar pendiente, eliminar egreso manual) y resumen por período (`/cash/summary`). Verificación técnica realizada: `node --check` en archivos modificados/creados y `node -e require(...)` OK para `cashController`, `validations/cash` y `routes` desde `backend/`. No se ejecutaron pruebas funcionales/E2E automáticas destructivas; resta validación de usuario/runtime (C-C5/E2E).

L15 (2026-11-19): Punto 8 (frontend Caja, base) implementado en rama `caja` (sin commit). Agregada página `frontend/src/pages/admin/AdminCash.jsx` (Resumen, Movimientos con filtros y acciones, Egresos/Categorías, Cierre diario apertura/arqueo/cierre), ruta `/admin/caja` en `frontend/src/App.jsx` y acceso en `frontend/src/pages/admin/AdminLayout.jsx`. Ajustes de integración: `frontend/src/pages/Invoicing.jsx` incorpora `payment_method` en formulario/detalle y lo envía en guardar/emitir/autorizar (incl. emisión interna) para compatibilidad con backend/Caja; `frontend/src/components/technical-repairs/ReparacionTab.jsx` requiere y envía forma de cobro al guardar estado `cobrado s/facturacion`. Verificación técnica: `cd frontend && npx --no-install vite build` OK. Pendiente validación funcional por usuario (flujos completos UI↔API), posibles ajustes UX y cobertura E2E. EntradaTab no ajustada para capturar forma de cobro al crear/editar directamente en estado `cobrado s/facturacion` (flujo recomendado desde Reparación).

L16 (2026-11-19): Punto 9 (cierre técnico C-E1..C-E3, sin E2E automatizado destructivo) en rama `caja` (sin commit). Verificaciones: `node --check` OK en controladores/rutas/validaciones de caja y módulos integrados (`invoices`, `orders`, `technicalRepairs`); `vite build` OK tras ajuste final. Ajuste de consistencia: `frontend/src/pages/admin/AdminCash.jsx` usa fecha local (`YYYY-MM-DD`) en lugar de UTC para fechas de sesión/filtros. Revisión de consistencia de integraciones: facturas requieren `payment_method` al emitir/autorizar y sincronizan/anulan movimientos; pedidos sincronizan en `delivered`/`cancelled`; reparaciones sincronizan en `cobrado s/facturacion` (con forma de cobro) y anulan al salir/eliminar; al facturar reparación con ítems vinculados se anula cobro directo previo para evitar duplicado. No se ejecutaron `npm test` ni `npm run seed` ni pruebas E2E automatizadas (potencialmente destructivos/sensibles al entorno). Requiere validación E2E manual del usuario en entorno test/local (checklist entregado en reporte).

L17 (2026-11-19): Correcciones solicitadas (cierre y saldo esperado) en rama `caja` (sin commit). Backend (`cashController`): helper `computeSessionCashState` reutilizado para calcular efectivo esperado; `closeSession` valida monto contado y cierra con snapshot basado en estado calculado; `getCurrentSession` y `getSummary` devuelven `cash_state`/`cash_balance` (saldo efectivo que debería haber para sesión abierta/del día). Frontend (`AdminCash`): muestra saldo efectivo esperado actualizado en Resumen y en Cierre diario, y en modal de cierre muestra esperado/desglose y diferencia estimada antes de confirmar. Verificación técnica: `node --check` backend OK y `vite build` frontend OK. Pendiente validación del usuario del caso reportado (apertura 13000, egreso 1000, cierre con 3000 contado).

L18 (2026-11-19): Corrección por sesión cerrada/movimientos sin caja abierta en rama `caja` (sin commit). Backend (`cashController`): sesiones cerradas ya no recalculan efectivo esperado desde movimientos vivos (usan snapshot/valores guardados); nuevos movimientos no se asocian a sesiones cerradas; crear/editar movimientos manuales (ingresos/egresos manuales) requiere sesión de caja abierta y se registran en la sesión abierta vigente. Los movimientos automáticos por eventos de negocio siguen registrándose, pero si no hay sesión abierta no se vinculan a una sesión cerrada. Verificación técnica: `node --check` backend OK y `vite build` frontend OK. Pendiente validación del usuario (intentar registrar movimiento con caja cerrada y confirmar que una sesión cerrada no cambia).

L19 (2026-11-19): Validación funcional manual (usuario): **Sección 1 — Sesión y cierre diario: OK** (reportado por el usuario). Quedan pendientes de validar las demás secciones del checklist (movimientos/egresos/ingresos manuales y L18, integraciones automáticas, resumen/filtros/UI). Usuario solicita para mañana como **primera tarea**: corrección/mejora de ingresos pendientes con **vista/listado dedicado de ingresos pendientes y confirmación por botón** (opción A). Registrado como T10.

L20 (2026-11-20): Inicio T10 (opción A, autorización del usuario). Frontend `frontend/src/pages/admin/AdminCash.jsx`: nueva pestaña **"Ingresos pendientes"** con vista/listado dedicado (carga ingresos con estado `pendiente_verificacion` y `pendiente_cobro`), resumen de montos pendientes, actualización, tabla con detalle (fecha, concepto, origen, medio, estado, monto) y botón **"Confirmar cobro"** por ítem; al confirmar se actualizan pendientes, resumen y movimientos. Sin cambios de backend (usa `GET /api/cash/movements` y `POST /api/cash/movements/:id/confirm`). Build frontend verificado OK (`vite build` ✓). Pendiente validación funcional del usuario.

L21 (2026-11-20): Usuario validó **T10 OK** (vista/listado dedicado de ingresos pendientes con confirmación por botón). Se continúa con validación pendiente del checklist de Caja (Secciones 2–4).

L22 (2026-11-20): Feedback validación Sección 2 (usuario): **Caso L18 OK**. Solicitudes/correcciones reportadas: (1) al eliminar egreso usar toast en vez del alert del navegador (actualmente `window.confirm`); (2) en Resumen los datos mostrados deben ser los del día; al cierre de caja los datos en Resumen se limpian y solo se ven en el historial; (3) en ingresos pendientes los nuevos no se muestran hasta actualizar con botón o recargar página. Pendiente precisar alcance de (1)-(3) antes de implementar.

L23 (2026-11-20): (1) confirmado por usuario: usar modal de confirmación en la app (no `window.confirm`). Implementado en `frontend/src/pages/admin/AdminCash.jsx` (modal "Eliminar egreso manual" con Confirmar/Cancelar y toast al eliminar). Build frontend verificado OK (`vite build` ✓). Pendiente validación del usuario.

L24 (2026-11-20): (2) aclarado por usuario: si hay caja abierta mostrar datos del día de la sesión abierta; si está cerrada mostrar datos del día anterior; si se cambian fechas, respetar filtro. También solicitado: en detalle de cierre opción "Ver más detalle"; en pestaña Cierre quitar botón de apertura y moverlo al header entre "Ingreso manual" y actualizar; junto al título "Caja" mostrar estado Abierta/Cerrada. Implementado en `frontend/src/pages/admin/AdminCash.jsx` (defaults de resumen por sesión, estado y botón en header, detalle de sesión/cierre en modal, apertura removida de pestaña Cierre). Build frontend verificado OK (`vite build` ✓). **Validado OK por el usuario.**

L25 (2026-11-20): (3) aclarado por usuario: actualizar ingresos pendientes automáticamente al entrar a la pestaña o al realizar algún cambio. Implementado en `frontend/src/pages/admin/AdminCash.jsx` (recarga al seleccionar pestaña "Ingresos pendientes" y al registrar ingreso manual/anular movimientos; confirmación ya refrescaba). Build frontend verificado OK (`vite build` ✓). **Validado OK por el usuario** (junto con (1)).

L26 (2026-11-20): Usuario confirma (1),(2),(3) OK. Nuevas solicitudes: (A) la fecha de apertura y cierre de caja debe ser siempre la misma (pendiente precisar regla); (B) en pestaña Cierre dejar solo el panel de detalle usando todo el ancho (quitar listado de sesiones recientes). (B) implementado en `frontend/src/pages/admin/AdminCash.jsx` (build verificado OK, `vite build` ✓). (A) pendiente de aclaración.

L27 (2026-11-20): (A) aclarado por usuario: abrir y cerrar el mismo día calendario; al abrir siempre fecha actual; si no se cierra y pasa al día siguiente, se debe solicitar cierre antes de realizar ningún movimiento. Implementado: backend `cashController` fuerza apertura con fecha de hoy, bloquea creación/edición de movimientos manuales y creación de movimientos automáticos de caja si hay sesión abierta de día anterior (409, cierre requerido); frontend `AdminCash` fija fecha de apertura a hoy, detecta sesión abierta vencida, muestra aviso/botón para cerrar y deshabilita acciones de ingreso/egreso manual. Build frontend y `node --check` backend OK. **Validado OK por el usuario.**

L28 (2026-11-20): (B) nuevo ajuste solicitado y aclarado: pestaña Cierre muestra solo un panel con el histórico de cierres (sesiones cerradas) y opción "Ver más detalle" en cada uno; el botón "Cerrar caja" se ubica en Resumen junto al cuadro de saldo de caja actual (siempre visible, deshabilitado si no hay sesión abierta). Implementado en `frontend/src/pages/admin/AdminCash.jsx`. Build frontend verificado OK (`vite build` ✓). **Validado OK por el usuario.**

L29 (2026-11-20): **Sección 2 OK** (usuario): egreso manual, categorías, ingreso manual, confirmar pendientes y editar/anular/eliminar egreso manual validados (L18 ya OK). Hallazgos/fallos reportados al continuar (Sección 3/facturación): (1) facturación no debería permitirse si la caja está cerrada; (2) al anular una factura no se recompone el stock de los productos y los valores de caja deberían corregirse también.

L30 (2026-11-20): Correcciones aplicadas y **validadas OK por el usuario**: (1) `invoicesController` exige caja abierta y no vencida para emitir (`issue`) y autorizar ARCA (`authorizeArca`) usando helpers exportados de `cashController` (`getOpenSession`, `isStaleOpenSession`); si no hay sesión abierta o está vencida, responde 409. (2) `voidInvoice` repone stock descontado al emitir (`restoreInvoiceStock`, misma lógica de ítems que `deductInvoiceStock`) dentro de la transacción y mantiene `syncInvoiceCashMovement` para anular el movimiento de caja asociado. Verificación técnica: `node --check` en `cashController` e `invoicesController` OK. Validación funcional confirmada por el usuario.

### Diseño consolidado propuesto (Punto 5, pendiente aprobación)

#### 5.1 Alcance y principios
- MVP en rama `caja`, acceso `admin`/`superadmin`.
- Moneda ARS, montos con 2 decimales.
- Ingresos en modelo **mixto** (`cobrado` / `pendiente`) con visibilidad de pendientes; egresos registrados como realizados (con editar/eliminar/anular).
- Cierre **diario** con apertura, arqueo de efectivo contado y cálculo de diferencias.
- Sin adjuntos, sin conciliación bancaria, sin múltiples cajas/turnos, sin migración histórica automática (salvo lo definido).

#### 5.2 Modelo de datos propuesto (nuevas tablas/cambios)

**Nuevas tablas**
- `cash_sessions` (apertura/cierre diario)
  - `id` PK
  - `session_date` date NOT NULL (única o una abierta por fecha según regla)
  - `status` text NOT NULL CHECK (`abierta`, `cerrada`)
  - `opening_balance` numeric(12,2) NOT NULL DEFAULT 0 (saldo inicial en efectivo)
  - `counted_cash` numeric(12,2) NULL (arqueo efectivo contado al cerrar)
  - `expected_cash` numeric(12,2) NULL (efectivo esperado al cerrar)
  - `difference` numeric(12,2) NULL (`counted_cash - expected_cash`)
  - `totals_snapshot` jsonb NULL (resumen: ingresos cobrados/pendientes por medio, egresos, etc.)
  - `notes` text NULL
  - `opened_by`, `opened_at`, `closed_by`, `closed_at`
  - `created_at`, `updated_at`
  - Restricción operativa: **a lo sumo una sesión `abierta` a la vez** (y una por día).

- `cash_categories` (categorías, principalmente egresos)
  - `id` PK
  - `name` text NOT NULL UNIQUE (o único case-insensitive)
  - `is_active` boolean NOT NULL DEFAULT true
  - `is_default` boolean NOT NULL DEFAULT false
  - `created_by`, `created_at`, `updated_at`
  - Semilla inicial: `Proveedores/Mercadería`, `Servicios (luz, internet, alquiler)`, `Sueldos`, `Impuestos`, `Mantenimiento`, `Envíos/Fletes`, `Otros`. Alta de nuevas categorías desde modal al requerirlas.

- `cash_movements` (movimientos unificados)
  - `id` PK
  - `movement_type` text NOT NULL CHECK (`ingreso`, `egreso`)
  - `origin_type` text NOT NULL CHECK (`factura`, `pedido`, `reparacion`, `otro`, `egreso_manual`)
  - `origin_id` integer NULL (id de factura/pedido/reparación según origen)
  - `cash_session_id` integer NULL FK `cash_sessions` (sesión/día asociada)
  - `movement_date` date NOT NULL (fecha del movimiento/registro)
  - `amount` numeric(12,2) NOT NULL CHECK (> 0)
  - `status` text NOT NULL
    - ingresos: `cobrado`, `pendiente_verificacion` (transferencia por verificar), `pendiente_cobro` (cuenta corriente), `anulado`
    - egresos: `registrado`, `anulado`
  - `payment_method` text NOT NULL CHECK (`efectivo`, `transferencia`, `cuenta_corriente`, `otro`)
  - `description` text NOT NULL (concepto)
  - `category_id` integer NULL FK `cash_categories` (requerido para egresos; opcional/nulo para ingresos según origen)
  - `reference` text NULL (n° comprobante/referencia)
  - `counterparty` text NULL (proveedor/destinatario/cliente, opcional)
  - `notes` text NULL
  - `accredited_at` date/timestamptz NULL (fecha de acreditación/cobro confirmado)
  - `accredited_by` integer NULL
  - `voided_at`, `voided_by`, `void_reason` NULL
  - `created_by`, `created_at`, `updated_at`
  - `metadata` jsonb NULL
  - Índices por fecha, tipo, estado, origen, sesión, categoría.

**Cambios en tablas existentes (propuestos)**
- `invoices`: agregar campos de cobro para Caja al facturar: `payment_method`/condición (`efectivo`, `transferencia`, `cuenta_corriente`) y, si se requiere trazabilidad en comprobante, estado/fecha de cobro o vínculo al movimiento de caja (alternativa: el estado de cobro vive en `cash_movements` vinculado por `origin_type='factura'` y `origin_id`; se define en implementación manteniendo consistencia). Mínimo necesario: poder seleccionar tipo de pago/forma de cobro al momento de facturar.
- `technical_repairs`: agregar estado operativo/de cobro **`cobrado s/facturacion`** (catálogo/validación de estados y UI) y registrar forma de cobro al cambiar a ese estado (en movimiento de caja y/o campo en reparación según diseño final).
- `orders`: sin cambios de esquema obligatorios; se usa `payment_method` existente y transición a `delivered`.

#### 5.3 Flujos y reglas de negocio

**A. Ingresos (mixto)**
- Regla general de acreditación:
  - `efectivo` → `cobrado` (acreditado de inmediato).
  - `transferencia` → `pendiente_verificacion` (registrado para verificación manual en cuentas bancarias; se acredita al confirmar verificación).
  - `cuenta_corriente` → `pendiente_cobro` (no acreditado hasta registrar pago/cobro).
- Confirmación de pendientes: acción manual (admin/superadmin) para marcar `pendiente_verificacion` o `pendiente_cobro` como `cobrado`, registrando `accredited_at/by` (y fecha efectiva si corresponde).
- Visibilidad: Caja lista/resume cobrados y pendientes (filtros por estado).

**B. Ingresos por origen**
- **Factura (`emitida`, no anulada):** al facturar se elige tipo/forma de cobro (`efectivo|transferencia|cuenta_corriente`) y se genera movimiento de ingreso vinculado a la factura con estado según regla (efectivo cobrado, transferencia pendiente verificación, cuenta corriente pendiente cobro). Facturas anuladas: el movimiento asociado pasa a `anulado`/ajuste según regla (no suma en resumen).
- **Pedido online:** al pasar a estado `entregado` (`delivered`), se genera movimiento (idempotente por pedido) usando `payment_method` del pedido: `efectivo`→cobrado, `transferencia`→pendiente verificación. Monto = total del pedido.
- **Reparación sin factura:** al cambiar a estado `cobrado s/facturacion` se selecciona forma de cobro (`efectivo|transferencia`) y se genera movimiento (idempotente): efectivo cobrado, transferencia pendiente verificación. Si la reparación se factura, el ingreso se refleja por la factura (no duplicar cobro directo).
- **Otros ingresos:** registro manual, se cargan como `cobrado` al registrar (con fecha, monto, concepto, medio, etc.).

**C. Egresos**
- Registro manual como `registrado` (realizado/pagado) al cargar.
- Campos: fecha, monto, concepto, categoría, medio de pago (`efectivo|transferencia|otro`), referencia, proveedor/destinatario, notas.
- Acciones: **editar**, **eliminar** y **anular** (anular mantiene historial con estado `anulado` y motivo/registro; eliminar quita el registro; editar corrige datos). Reglas de permisos/confirmación en UI.

**D. Sesión/cierre diario (Opción B)**
- **Apertura:** se abre sesión diaria con `opening_balance` (saldo inicial en efectivo). No permitir más de una sesión abierta simultáneamente.
- **Operación:** movimientos del día/sesión visibles; efectivo esperado se calcula en base a saldo inicial + ingresos cobrados en efectivo − egresos en efectivo (según sesión/fecha y excluyendo anulados; detalle fino en implementación).
- **Cierre:** ingreso de `counted_cash` (arqueo de efectivo contado), cálculo de `expected_cash` y `difference` (`counted - expected`), guardado de `totals_snapshot` y cierre (`cerrada`). Resumen por período disponible independiente del cierre.

**E. Resúmenes y filtros**
- Resumen por período: total ingresos cobrados, total ingresos pendientes (y desglose útil), total egresos, saldo/neto; con filtros por fecha/período, tipo, estado, origen, medio de pago, categoría.
- Movimientos no anulados computan según estado (pendientes visibles y diferenciados de cobrados).

#### 5.4 Permisos y UI (propuesta)
- Acceso módulo Caja: `admin` y `superadmin`.
- Sección en Admin: “Caja” (Dashboard/resumen, Movimientos, Ingresos/pendientes, Egresos, Cierre diario/apertura-arqueo).
- Integraciones UI: selección de tipo/forma de cobro al facturar; selección de forma de cobro al marcar reparación `cobrado s/facturacion`; acción para confirmar acreditación/cobro de pendientes (transferencia/cuenta corriente). Categorías de egreso seleccionables con opción “Agregar nueva” en modal.
- Textos/etiquetas en español, estados vacíos/carga/error.

#### 5.5 Criterios de aceptación (Punto 5)
- Se puede abrir/cerrar caja diaria con saldo inicial, arqueo contado y diferencia calculada.
- Se registran egresos manuales con categorías (incluida creación desde modal) y acciones editar/eliminar/anular.
- Se registran ingresos mixtos por origen con reglas definidas (factura, pedido entregado, reparación cobrada s/factura, otros), distinguiendo cobrados y pendientes.
- Se puede confirmar/verificar cobros pendientes (transferencia/cuenta corriente) y reflejarlos como cobrados.
- Listado y resumen por período muestran totales coherentes (cobrados/pendientes/egresos/saldo) con filtros básicos.
- Sin duplicar ingresos cuando una reparación se factura.

#### 5.6 Impactos/riesgos a considerar
- Cambios en facturación (tipo/forma de cobro al emitir) y en servicio técnico (nuevo estado `cobrado s/facturacion` y captura de forma de cobro).
- Idempotencia al generar movimientos desde eventos (pedido entregado, cambio de estado reparación, emisión factura).
- Definición fina de edición/eliminación/anulación sobre movimientos vinculados a orígenes (especialmente ingresos automáticos).
- Consistencia con reglas ya implementadas (stock/doble facturación, ARCA, numeración).

#### 5.7 Pendiente de tu aprobación
- Este diseño consolida Puntos 0–4 y es la base para Puntos 6–9 (migraciones, backend, frontend, cierre). Requiere tu OK antes de implementar.

L31 (2026-11-21): Sección 3 — Caso 1 validado OK por usuario. Caso 2 (sync original pedido delivered/cancelled) validado OK por usuario, pero reportó cambios de alcance: renombrar estados de pedido a español (`pending→pendiente, confirmed→confirmado, processing→preparando, shipped→enviado, delivered→cobrado, cancelled→cancelado`), `cobrado` mantiene efecto caja/stock de `delivered`; agregar estado `facturado`; desde `cobrado` habilitar facturar pedido generando factura por flujo normal sin afectar caja/stock y pasando pedido a `facturado`; en `facturado` deshabilitar cambios manuales de estado. Opción general en factura “No afectar caja/stock (ya cobrado/registrado)”, premarcada desde pedido cobrado. Anular factura desde pedido: pedido a `cancelado`, repone stock; caja: si sesión original abierta mismo día corregir movimiento original; si sesión original cerrada pero hay caja abierta válida hoy crear egreso compensatorio automático (`Anulación pedido #X (cobrado el DD/MM/YYYY)`, mismo medio de pago) y marcar original anulado/compensado; si hoy no hay caja abierta válida bloquear con aviso. Usuario confirmó plan T11-T15. Inicia implementación.

L32 (2026-11-21): T11-T14 implementados en código (pendiente validación usuario). Migraciones creadas/aplicadas en BD test: `019_order_status_rename.sql` (renombre estados + `facturado` + default `confirmado`), `020_invoice_skip_cash_stock_impact.sql` (`invoices.skip_cash_stock_impact` bool default false), `021_invoice_order_id.sql` (`invoices.order_id` FK orders). Backend: `ordersController` (estados ES, bloqueo manual en `facturado`, `POST /orders/:id/void-invoice` con corrección caja misma-sesión/compensatorio/bloqueo + reposición stock), `cashController.syncOrderCashMovement` (cobrado/cancelado), `dashboardController` (filtros estados), `invoicesController` (order_id, skip_cash_stock_impact en create/update/issue/authorizeArca/void; normal void bloqueada si factura vinculada a pedido facturado; `markOrderFacturadoIfLinked` al emitir), rutas. Frontend: `AdminOrders` (labels ES, botón Facturar en cobrado, anular factura en facturado con modal), `Invoicing` (checkbox “No afectar caja/stock”, prefill desde `?order_id=`, order_id en payload), `Dashboard` filtro actualizado. Checks: `node --check` OK en controllers/rutas tocados; `vite build` OK. Pendiente T15 validación manual usuario en BD test/local.

L33 (2026-11-21): Bugfix validación usuario (facturar desde pedido no pasaba a `facturado`): causa raíz en `backend/src/validations/invoices.js`, los schemas Zod de create/update no incluían `order_id` ni `skip_cash_stock_impact` y el middleware los descartaba; se agregaron ambos campos. Se reinició backend dev; verificado por API que ahora persiste `order_id` y `skip_cash_stock_impact`. Eliminados borradores de prueba 17-21; quedan facturas emitidas 11,12,14,15,16 de intentos previos con `order_id` null (ruido de test DB).

L34 (2026-11-21, cierre): Commit `1343d73` en `test` pusheado a `origin/test` (`feat(pedidos-facturacion)`). Migraciones 018-021 aplicadas en BD producción (`ep-long-leaf...`, `NEON_BRANCH=production`) con confirmación explícita del usuario; merge a `main` pendiente por usuario. Validación usuario: Sección 3 Caso 1 OK; flujo facturar desde pedido cobrado OK tras fixes (prefill, schema Zod, SIN CAMBIO en impacto stock); auto-cambio preparando→confirmado al tildar todos los ítems OK. Pendiente validación manual restante: casos T14 (anular factura desde pedido, 3 escenarios caja), y checklist Sección 3 restante/Sección 4 según corresponda. Repo limpio, backend dev detenido.

L35 (2026-11-24): Usuario confirmó **T14 validado OK** (anular factura desde pedido `facturado`, 3 escenarios de caja: sesión original abierta mismo día; sesión original cerrada + caja abierta hoy con egreso compensatorio; sin caja abierta hoy bloquea con aviso). Pendiente: resto de validación Sección 3/4 según checklist ODD.

L36 (2026-11-24): Validación Sección 3 reparación `cobrado s/facturacion`: Caso 1 y 2 OK por usuario. Caso 3 detectó bug: al facturar reparación en `cobrado s/facturacion` el importe no se duplicaba, pero el estado quedaba en `cobrado s/facturacion` permitiendo cambios de estado inconsistentes (caja no volvía a 0 hasta anular factura porque el ingreso activo era el de factura). Fix confirmado por usuario e implementado: migración `022_repair_facturado_status.sql` agrega estado `facturado` en catálogo de reparaciones y columna `technical_repairs.status_before_invoice`; al emitir/autorizar ARCA factura con ítems de reparación en `cobrado s/facturacion` pasa reparación a `facturado` y guarda estado previo; al anular factura (invoicesController u ordersController.voidLinkedInvoice) restaura estado previo (si no hay otra factura emitida vinculada); guards backend bloquean cambio manual a/desde `facturado`; frontend ReparacionTab deshabilita estado cuando está `facturado`. Verificación técnica: `node --check` OK en controllers tocados, backend reiniciado en :4000. **Incidente:** al correr migraciones, el runner usó `DATABASE_URL_UNPOOLED` (apunta a prod `ep-long-leaf...`) y aplicó 022 en prod sin confirmación explícita; migración es aditiva/no destructiva (INSERT ON CONFLICT DO NOTHING + ADD COLUMN IF NOT EXISTS nullable). Luego se aplicó 022 correctamente en test DB (`ep-odd-tree...`) con `DATABASE_URL_UNPOOLED=""`. Pendiente: revalidar Caso 3 con fix por usuario.

L37 (2026-11-24): Usuario revalidó **Caso 3 OK** con el fix: reparación en `cobrado s/facturacion` facturada pasa a `facturado`, no duplica ingreso, no permite cambio manual de estado (probado también desde pestaña Entrada); al anular factura vuelve al estado anterior y corrige caja. Nota UX: facturar reparación en `cobrado s/facturacion` se hace desde **Histórico de Órdenes** (botón Facturar servicio); la pestaña Reparación no la lista por ser estado fuera de activos. Sección 3 reparación `cobrado s/facturacion` (casos 1-3) **OK**. Pendiente: resto de Sección 3/4 según checklist ODD.

L38 (2026-11-24): Sección 3 Factura emitir/anular/doble facturación reparación: Casos 1 y 2 OK por usuario. Caso 3 detectó bug: `assertNoDoubleRepairInvoicing` comparaba la factura consigo misma (join incorrecto) y frontend permitía continuar con `window.confirm`; se corrigió query backend y frontend ahora bloquea con toast. Revalidado Caso 3 OK. Queda ruido test DB: facturas emitidas 27 y 28 con misma reparación #15. Pendiente: Sección 3 pedido cobrado/cancelado; Sección 4.

L39 (2026-11-25): Sección 3 pedido cobrado/cancelado: usuario probó cobrado con caja cerrada y detectó que cambiaba estado pero no exigía caja abierta; fix aplicado en `ordersController.updateStatus` (bloquea transición a `cobrado` sin sesión de caja abierta/no vencida, 409). Backend reiniciado. Usuario dio **Sección 3 OK**. Nota: pedido #7 (CS251105-3485) quedó cobrado con movimiento 33 sin sesión por la prueba previa al fix; queda como dato de test DB si se quiere limpiar. Pendiente: Sección 4.

L40 (2026-11-25): Sección 4 validada OK por usuario. Ajustes realizados durante validación: paginación Movimientos a 20; pestaña "Ingresos pendientes" renombrada a "Ingresos por transferencia" con historial solo transferencias (cualquier estado), detalle por ingreso, columnas Medio/Origen quitadas, acciones con iconos+tooltip y menor espaciado; Resumen muestra "Ingresos por transferencia (cobrados)" y "Transferencias pendientes" con métricas específicas de transferencia (backend summary). Facturación UI payment_method y Reparación UI forma de cobro en `cobrado s/facturacion` validados OK. Pendiente: commit/push si usuario lo pide; merge a main lo maneja usuario.
