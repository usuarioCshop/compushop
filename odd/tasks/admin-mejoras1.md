# Admin — mejoras 1 (Bloque 2)

## Header
- Objetivo: mejorar módulo Admin en rama `admin` (derivada de `origin/dev2`): notificación de pedidos pendientes (campana/badge), filtros de productos (sin imágenes/sin stock), exportación de listado de productos, navegación desde Dashboard y cierre/regresión.
- Rama: admin (derivada de origin/dev2)
- Estrategia de entrega: ask-on-risk
- Runner de tests: node --test backend (destructivo si se corre completo; no ejecutar sin aviso). Frontend: build/vite.

## Specs
S1 (2.1, D-3 confirmado): Notificación de pedidos pendientes para usuarios admin/superadmin en Navbar. **D-3 confirmado:** se consideran “pendientes/nuevos” los pedidos con estado `pending` y `confirmed`; contador vía endpoint/API, actualización al cargar/navegar, al cambiar estado y polling liviano. Campana con badge/contador.
S2 (2.2): En Admin Productos, agregar filtros “Sin imágenes” y “Sin stock”, combinables con búsqueda, categoría, marca y paginación/listado actual. Backend/query soporta estos filtros cuando corresponda.
S3 (2.3, D-4 confirmado): Exportar listado de productos desde Admin Productos. **D-4 confirmado:** formato XLSX descargable (`productos-YYYYMMDD.xlsx`), con todos los campos/columnas actuales en el mismo orden, exportando todo (activos e inactivos) por ahora y respetando filtros aplicados en la pantalla (incluida marca).
S4 (2.4): Dashboard con navegación: bloques/indicadores clickeables a sección correspondiente (con filtro/contexto cuando aplique). En “Stock bajo”, clic en fila lleva a edición del producto.
S5 (2.5): Regresión en Navbar, Productos y Dashboard; ajustes de UX/estados vacíos/carga; preparar integración a dev2.

## Tasks
- [x] T1 | S1,S5 | inline | Verificado (D-3 confirmado): `GET /orders/pending-count` (admin, `pending,confirmed`) y campana/badge en Navbar; actualización al cargar/navegar, al cambiar estado (`orders:pending-changed` + reintento) y polling cada 30s.
- [x] T2 | S2,S5 | inline | Verificado manualmente: filtros “Sin imágenes” y “Sin stock” en Admin Productos (UI cliente + soporte `no_image`/`no_stock` en `productsController.getAll`).
- [x] T3 | S3,S5 | inline | Ajustado a D-4 confirmado (pendiente verificación manual del cambio): exportación XLSX `GET /products/export` (admin, columnas/orden actuales, todo activo/inactivo, respeta filtros incluidos marca y sin imágenes/sin stock) y descarga `productos-YYYYMMDD.xlsx`.
- [x] T4 | S4,S5 | inline | Verificado manualmente: navegación desde Dashboard; filas de stock bajo abren edición (`/admin/productos?edit=id`); AdminOrders filtra por `?status=`; AdminProducts abre edición por `?edit=`.
- [x] T5 | S1-S5 | inline | **D-3 y D-4 confirmados; T1-T4 verificados manualmente** (incluida exportación XLSX con filtros). Bloque 2 Admin cerrado en rama `admin`, listo para integrar a `test`.

## Log
L1 (2026-11-18): inicio Bloque 2 Admin en rama `admin` desde `origin/dev2` (por pedido del usuario tras cierre/verificación de Servicio en `test`). Decisiones pendientes asumidas temporalmente: D-3 (pendientes/nuevos = `pending`,`confirmed`, actualización en carga/navegación) y D-4 (export CSV UTF-8 con todos los campos, según filtros aplicados). A confirmar.
L2 (2026-11-18): Implementados T1-T4 en rama `admin`. Backend: `ordersController.getPendingCount` + ruta `/orders/pending-count`, filtros `no_image`/`no_stock` y `productsController.exportCsv` + ruta `/products/export`. Frontend: campana/badge en `Navbar`, filtros y exportación en `AdminProducts`, navegación/contexto desde `Dashboard`, soporte `?status=` en `AdminOrders` y `?edit=` en `AdminProducts`. Pendiente T5 (verificación/regresión) y confirmación D-3/D-4.
L3 (2026-11-18/19): T5 técnico en rama `admin`: `node --check`/`vite build` OK, ajustes T1 (badge + polling) y fix `getAll` (`no_image/no_stock`). **T1, T2, T4 verificados; D-3 confirmado**.
L4 (2026-11-19): **D-4 confirmado** (XLSX, columnas/orden actuales, exportar todo, respetar todos los filtros, nombre `productos-YYYYMMDD.xlsx`). Ajustado T3: exportación XLSX en backend/frontend, soporte de filtro `brand` en `getAll`/export. Exportación verificada manualmente (OK). T5 cerrado; preparado commit e integración a `test`.
