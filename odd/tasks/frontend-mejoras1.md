# Frontend — mejoras 1

## Header
- Objetivo: mejoras de frontend solicitadas para admin/superadmin.
- Rama: `test` (definir si se crea rama específica antes de implementar).
- Estado: checklist definido, pendiente de implementación/validación.

## Checklist

- [x] **F1 — Sidebar (admin/superAdmin):** agregar ítem **Facturación** y ítem **Servicio Técnico** en el sidebar para los roles `admin` y `superAdmin`. (implementado en `AdminLayout.jsx`)
- [x] **F2 — Pedidos:** agregar filtros en la sección de Pedidos. (implementado: búsqueda, estado, forma de pago, rango de fechas, paginación en `AdminOrders.jsx` + filtros en `ordersController.getAll`)
- [x] **F3 — Servicio Técnico / Reparación:** las boletas deben aparecer todas, independientemente del estado. (implementado en `ReparacionTab.jsx`)
- [x] **F4 — Frontend auto-reload en desarrollo:** instalar/configurar las dependencias necesarias para que el frontend se reinicie/actualice automáticamente ante cada cambio durante el desarrollo. (configurado `server.watch.usePolling: true` en `frontend/vite.config.js`)
- [x] **F5 — Adaptación y optimización para diseño móvil:** adaptar la experiencia frontend para uso cómodo en dispositivos móviles (ver detalle y criterios de aceptación). (CA1-CA8 completados; CA8 confirmado por usuario)
- [x] **F6 — Dashboard backup BD (admin/superAdmin):** agregar en el Dashboard una opción para que `admin` y `superAdmin` puedan realizar backup de la base de datos. (endpoint `GET /dashboard/backup`, botón en Dashboard; requiere `pg_dump` en el servidor)

## Detalle F5 — Adaptación y optimización para diseño móvil

### Objetivo
Permitir que las vistas principales del frontend (especialmente admin/superadmin) sean usables en pantallas móviles sin pérdida de funcionalidad clave.

### Alcance sugerido
- Layout general: sidebar, header, contenido y espaciados.
- Navegación: menú/sidebar accesible en móvil (drawer/colapsable).
- Tablas y listados: legibles sin overflow roto; usar scroll horizontal controlado, cards o colapsado según el caso.
- Formularios y modales: campos, botones y acciones táctiles cómodas.
- Filtros, paginación y acciones por fila: accesibles en pantallas chicas.
- Vistas prioritarias: Dashboard, Caja, Pedidos, Facturación, Servicio Técnico, Productos/Usuarios según aplique.

### Criterios de aceptación
- [x] **CA1 — Navegación móvil:** en viewport móvil, el sidebar no rompe el layout; se puede abrir/cerrar (drawer o equivalente) y acceder a todos los ítems visibles por rol. (AdminHorizontalNav con drawer móvil)
- [x] **CA2 — Sin overflow horizontal accidental:** las páginas principales no generan scroll horizontal a nivel de página, salvo contenedores explícitos (ej. tabla con `overflow-x` controlado). (overflowX hidden en layouts, minW responsivos en filtros/totales)
- [x] **CA3 — Tablas/listados usables:** en móvil, las tablas críticas (Pedidos, Caja/Movimientos, Facturación, Servicio Técnico) se pueden leer y operar; si no entran, usan patrón responsive (scroll horizontal contenido, cards o columnas prioritarias). (tablas críticas con overflowX/TableContainer)
- [x] **CA4 — Controles táctiles:** botones, iconos de acción, filtros y paginación tienen tamaño/espaciado táctil razonable y no se solapan. (IconButtons de acción elevados a md en vistas críticas)
- [x] **CA5 — Formularios/modales:** inputs, selects, datepickers y modales se visualizan completos en móvil; no quedan cortados ni requieren zoom para operar. (modales con tamaños responsive/scrollBehavior; grids base 1 columna en formularios críticos)
- [x] **CA6 — Flujos clave:** se pueden completar en móvil los flujos principales: revisar pedidos, filtrar, cambiar estado, registrar/ver caja, ver/emitir factura, ver/editar reparación. (cubierto por CA1-CA5; usuario confirmó OK)
- [x] **CA7 — Legibilidad:** tipografía, badges, estados y montos se leen correctamente sin superposición ni truncado que impida entender la información. (revisión de código; usuario confirmó OK)
- [x] **CA8 — Verificación:** validación manual en viewport móvil (ej. 360x800 / 390x844) y desktop, sin regresiones visibles en desktop. (usuario confirmó OK)

## Log
- L1 (2026-11-25): Checklist inicial definido por el usuario (F1-F3).
- L2 (2026-11-25): Agregado F4 (adaptación/optimización móvil) con detalle y criterios de aceptación CA1-CA8.
- L3 (2026-11-25): Agregado F6 (backup BD desde Dashboard para admin/superAdmin) y F4 (auto-reload frontend en desarrollo) antes de F5 móvil; F4 móvil renumerado a F5.
- L4 (2026-11-26): F1 implementado — agregados ítems Facturación (`/facturacion`) y Servicio Técnico (`/tecnico`) en sidebar de `frontend/src/pages/admin/AdminLayout.jsx`.
- L5 (2026-11-26): F2 implementado — filtros en AdminOrders (búsqueda, estado, forma de pago, desde/hasta) + paginación; backend `ordersController.getAll` soporta search, payment_method, date_from, date_to y status múltiple.
- L6 (2026-11-26): F3 implementado — `ReparacionTab.jsx` ahora carga todas las boletas sin filtrar por estados activos.
- L7 (2026-11-26): F4 implementado — `frontend/vite.config.js` usa `server.watch.usePolling: true` para recarga automática en entorno dev (incluye FS montado/WSL).
- L8 (2026-11-26): F5 CA1/CA2 base — AdminHorizontalNav con drawer móvil; overflowX hidden en AdminLayout/TechnicalRepairs/Invoicing; minW responsivos en HistoricoTab e Invoicing.
- L9 (2026-11-26): F5 CA3 — verificado patrón responsive en tablas críticas (Pedidos/Caja/Facturación/Servicio Técnico) con overflowX/TableContainer.
- L10 (2026-11-26): F5 CA4 — IconButtons de acción en tamaño md en Pedidos, Facturación y Caja para mejor tactilidad.
- L11 (2026-11-26): F5 CA5 — verificados modales/formularios críticos con tamaños responsive, scrollBehavior y grillas base 1 columna.
- L12 (2026-11-26): F5 CA6-CA8 cerrados con confirmación del usuario; F5 marcado completo.
- L13 (2026-11-26): F6 implementado — `GET /api/dashboard/backup` (admin/superAdmin, usa `pg_dump`) y botón "Backup BD" en Dashboard.
