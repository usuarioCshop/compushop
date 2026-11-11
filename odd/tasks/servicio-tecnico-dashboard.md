# Servicio técnico · Fase 3: dashboard, reparación e informes

Objetivo: convertir `/tecnico` en un dashboard con tres secciones (**Entrada**, **Reparación**, **Informes**) y agregar diagnóstico, repuestos tomados del catálogo de productos con descuento de stock, mano de obra y reportes.
Rama: `feature-ser-tec` (continuación de la fase 2). Entrega: `ask-on-risk`. Runner: `npm test` (backend, destructivo) / `npm run build` (frontend) / curl.

## Specs

S1. `/tecnico` pasa a ser un dashboard con un encabezado de KPIs y tres secciones: **Entrada**, **Reparación** e **Informes**. Solo técnico/admin/superadmin (mismo `requireTecnico`).

S2. KPIs del dashboard: total de boletas, pendientes, en proceso, reparadas/entregadas e ingresos estimados del mes (suma de mano de obra + repuestos de boletas recibidas en el mes, excluyendo `cancelado`). Se actualizan al guardar.

S3. **Entrada**: listado de boletas con búsqueda (Nº, cliente, DNI, artículo), filtro por estado, rango de fechas de recepción/probable, orden por columnas y paginación (se conserva lo de fase 2). Botón "Nueva entrada".

S4. **Entrada**: formulario de alta con datos del cliente (nombre, DNI, dirección, email, teléfono), datos del equipo (artículo, marca, modelo, Nº de serie, imagen), daño reportado, fecha probable, técnico asignado y Nº de boleta precargado. Se conservan los selects con `(+)`, la lupa de cliente y la validación con toasts.

S5. **Reparación**: listado de boletas en `pendiente`, `en_proceso` o `reparado` (no entregadas ni canceladas) con búsqueda. Al seleccionar una boleta se abre el espacio de trabajo de reparación.

S6. **Reparación**: el espacio de trabajo permite cargar `diagnóstico` (texto), `detalle de repuestos` (líneas tomadas del catálogo de productos, con cantidad y precio unitario), `mano de obra` (precio), `notas internas`, `estado` y `técnico asignado`. Calcula subtotal por repuesto, total de repuestos y total general = repuestos + mano de obra. Moneda ARS.

S7. Persistencia: migración 011 agrega `diagnosis TEXT` y `labor_price NUMERIC(12,2) NOT NULL DEFAULT 0` a `technical_repairs`, y crea `repair_parts`:
  - `id`, `repair_id` FK a `technical_repairs` ON DELETE CASCADE,
  - `product_id` FK a `products` ON DELETE RESTRICT,
  - `description TEXT NOT NULL` (snapshot del nombre del producto al usarlo),
  - `quantity INTEGER NOT NULL CHECK (quantity > 0)`,
  - `unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0)`,
  - `UNIQUE (repair_id, product_id)`, índices por `repair_id` y `product_id`, timestamps.
  - `products.stock` (INTEGER, CHECK >= 0) es la fuente de verdad del stock.

S8. Stock: guardar la boleta con una línea de repuesto equivale a **marcarlo como utilizado** y descuenta stock de forma atómica. Reglas:
  - Si no hay stock suficiente, la operación completa falla con `400` y un mensaje con el producto y el disponible; nunca queda stock negativo.
  - Al editar una boleta con `parts`, se devuelve el stock de las líneas anteriores y se descuenta el de las nuevas dentro de la misma transacción; si alguna línea no tiene stock, se revierte todo y se conserva el estado anterior.
  - Al quitar una línea, se devuelve su stock.
  - Al eliminar la boleta, se devuelve el stock de todas sus líneas antes de borrarla.
  - Los productos se bloquean con `SELECT ... FOR UPDATE` en orden ascendente de `id` para evitar carreras y deadlocks.
  - Cancelar una boleta no mueve stock por sí solo: el técnico quita la línea si el repuesto no se usó (decisión del usuario).

S9. La API de detalle (`GET /api/technical-repairs/:id`) devuelve la boleta con `parts` y totales (`parts_total`, `total`). El listado devuelve `parts_total` y `total` por boleta.

S10. `GET /api/technical-repairs/parts-catalog?search=` devuelve productos activos con stock > 0 en formato compacto `{ products: [{ id, name, brand, price, stock }] }`, límite 20, para el selector de repuestos.

S11. `GET /api/technical-repairs/stats` devuelve los KPIs (conteos por estado e ingresos del mes).

S12. `GET /api/technical-repairs/reports?group_by=status|client|equipment|part` devuelve filas agrupadas y totales. Filtros: rango de fechas de recepción, estado, cliente, artículo, marca y texto de repuesto.
  - `status`: estado, cantidad, total repuestos, total mano de obra, total.
  - `client`: cliente (nombre + DNI), cantidad, totales.
  - `equipment`: artículo, marca, modelo, cantidad, totales.
  - `part`: producto, cantidad total, cantidad de boletas, total repuestos.

S13. `GET /api/technical-repairs/reports/export` exporta el reporte con los mismos filtros y `group_by` en CSV (BOM UTF-8, comillas/comas/saltos y fórmulas escapadas, como el export actual).

S14. Validación zod: `diagnosis` texto hasta 4000; `labor_price` numérico >= 0; `parts` hasta 100 líneas, `product_id` entero positivo, `quantity` entero > 0, `unit_price` >= 0, sin productos repetidos en la misma boleta; query de reportes con enums y fechas válidas. Respuestas 400 con detalle, 404 si la boleta o el producto no existe, sin 500 por input inválido.

S15. Permisos: todos los endpoints nuevos usan `authenticate` + `requireTecnico`; un `customer` recibe 403.

S16. Compatibilidad: las boletas existentes muestran diagnóstico vacío, sin repuestos y mano de obra 0; los endpoints y el CSV actuales siguen funcionando. El CSV del listado se amplía con diagnóstico, resumen de repuestos, mano de obra y total.

S17. Frontend: se divide la página en `TechnicalRepairs.jsx` (shell + KPIs + tabs) y componentes en `frontend/src/components/technical-repairs/` (`EntradaTab`, `ReparacionTab`, `InformesTab`, `RepairPartsEditor`, `KpiCards`, `constants`). Se conservan catálogos, lupa de cliente, Nº de boleta, detalle, filtros, orden, técnico y export. El editor de repuestos busca en el catálogo, muestra stock disponible, cantidad, precio unitario, subtotal y avisa si la cantidad supera el stock.

S18. Formato: precios con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`; fechas de recepción en hora local y `probable_repair_date` en UTC (como la fase 2). Inputs numéricos con `type="number"`, `min` y `step` coherentes.

S19. Sin gráficos ni dependencias nuevas en esta fase; los informes son tablas con totales y CSV.

S20. Verificación: curl para alta/edición/borrado con repuestos, descuento y devolución de stock, stock insuficiente, edición de cantidades, reportes y CSV; `npm run build` del frontend; pasada visual en navegador.

### Supuestos

- A1: los repuestos son productos del catálogo; no se permiten repuestos de texto libre. Si falta un ítem, se carga antes en Productos.
- A2: guardar la boleta con la línea de repuesto es "marcarlo como utilizado"; ahí se descuenta el stock.
- A3: el precio unitario se toma del producto y se guarda como snapshot en la línea; se puede ajustar (descuento) sin modificar el precio del catálogo.
- A4: quitar una línea o eliminar la boleta devuelve el stock automáticamente.
- A5: **cancelar una boleta no devuelve stock automáticamente**; si el repuesto no se usó, el técnico quita la línea. Confirmado por el usuario.
- A6: un producto con repuestos usados no se puede borrar (`ON DELETE RESTRICT`); se desactiva. El endpoint de borrado de productos responde 409 con un mensaje claro.
- A7: el dashboard vive en `/tecnico` con tabs; "equipos" = artículo/marca/modelo; informes = tablas con totales + CSV; moneda ARS; se continúa en `feature-ser-tec`.

## Tasks

- T23 | S7, S16 | inline | migración 011 (`diagnosis`, `labor_price`, `repair_parts` con FK a `products`) + `KNOWN_TABLES` + 409 al borrar producto con repuestos | hecho — migración aplicada en test; FK verificada; DELETE producto con repuesto devuelve 409
- T24 | S8, S9 | inline | backend: partes y totales en listado/detalle; create/update/delete con transacción de stock | hecho — curl: crear 2 → stock 28; editar a 3 → 27; 9999 → 400 y stock intacto; quitar → 30; borrar → 30
- T25 | S10 | inline | backend: `GET /parts-catalog` (productos activos con stock) | hecho — curl devuelve productos activos con stock
- T26 | S14 | inline | backend: zod de diagnóstico/mano de obra/repuestos y query de reportes | hecho — duplicados, precio negativo, group_by y fecha inválida devuelven 400
- T27 | S11 | inline | backend: `GET /stats` (KPIs) | hecho — curl devuelve total/pendientes/en_proceso/reparados/entregados/cancelados/month_income
- T28 | S12 | inline | backend: `GET /reports` (estado, cliente, equipo, repuesto) | hecho — curl 4 agrupaciones con totales
- T29 | S13 | inline | backend: `GET /reports/export` CSV | hecho — CSV con BOM, encabezados y fila de totales
- T30 | S1, S17 | inline | frontend: shell del dashboard + KPIs + tabs + split de componentes | hecho — shell con KPIs y tabs Entrada/Reparación/Informes, componentes separados, build Vite OK
- T31 | S3, S4 | inline | frontend: Entrada (listado + alta + detalle) | hecho — módulo Entrada adaptado al dashboard conservando listado/alta/detalle, build Vite OK
- T32 | S5, S6, S17 | inline | frontend: Reparación (workbench + editor de repuestos con catálogo/stock + totales) | hecho — workbench con diagnóstico/mano de obra/repuestos desde catálogo y totales, build Vite OK (stock verificado en backend)
- T33 | S12 | inline | frontend: Informes (4 reportes + filtros + totales) | hecho — informes por estado/cliente/equipo/repuesto con filtros y totales, build Vite OK
- T34 | S13, S18 | inline | frontend: export CSV + formato ARS/fechas + pulido | hecho — export CSV de informes/listado y formato ARS/fechas, build Vite OK
- T35 | S20 | inline | verificación integral (curl + build + visual) | hecho — backend verificado con curl y frontend con `npm run build`; commit realizado; verificación visual manual en navegador pendiente por el usuario

## Log

- L1 (2026-11-11): Pedido del usuario (verbatim): «ok me gusta y esta funcional pero quisiera hacer una mejora del front asi que armemos un nuevo listado de tareas es decir la secion de servicio tecnico quisiera que tenga un dasborard con la secion Entrada (datos del cliente y equipo, etc), Reparacion (diagnostico, detalle de repuestos precio, etc) y otra de Informes donde se podra elegir distintos listados segun criterios de estado, clientes, equipos, o repuestos.»
- L2 (2026-11-11): Requisito adicional (verbatim): «esta muy bien pero ten esta concideracion adicional los respuesto usados del servicio deben tomarse del catalogo de productos teniendo en cuenta el descuento de stock al momento de marcarlo como utilizado en el servicio».
- L3 (2026-11-11): Exploración: la página actual (`frontend/src/pages/TechnicalRepairs.jsx`, 1454 líneas) es un listado + formulario único; el esquema tiene `technical_repairs` (migración 009) + catálogos/clientes/asignación (migración 010); `products` tiene `stock INTEGER CHECK (stock >= 0)`, `price`, `name`, `brand`, `is_active`; `ordersController` ya implementa descuento/devolución de stock con `db.transaction` y `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`; las rutas de técnico ya están antes de `/:id`; no hay `.codegraph/`.
- L4 (2026-11-11): Diseño actualizado con stock: `repair_parts` referencia `products`, el guardado descuenta stock de forma atómica, la edición devuelve y vuelve a descontar, y el borrado devuelve. Supuestos A1-A7 en la sección Specs. Pendiente confirmar A5 (cancelación) antes de escribir código.
- L5 (2026-11-11): Decisión del usuario sobre cancelación (verbatim): «prefiero manual». Se confirma A5: cancelar no mueve stock; el técnico quita la línea si el repuesto no se usó. Arranca implementación T23.
- L6 (2026-11-11): Backend T23-T29 implementado y verificado con curl sobre la base test. Evidencia: migración 011 aplicada (`repair_parts` con FK a `products`, `diagnosis`, `labor_price`); crear boleta con 2 unidades del producto 6 dejó stock 30→28; editar a 3 dejó 27; pedir 9999 devolvió 400 "Stock insuficiente..." y el stock quedó en 27 con la línea anterior intacta; quitar la línea devolvió a 30; borrar la boleta mantuvo 30. Borrar un producto con repuesto usado devuelve 409 (código Postgres 23001, además de 23503). `GET /stats` devuelve conteos e ingresos del mes; `GET /parts-catalog` devuelve activos con stock; `GET /reports?group_by=status|client|equipment|part` devuelve filas y totales; `GET /reports/export` devuelve CSV con BOM y fila de totales. Validaciones: repuesto duplicado, precio negativo, `group_by` inválido y fecha inexistente devuelven 400.
- L7 (2026-11-11): Frontend T30-T35 implementado: dashboard `/tecnico` con tabs Entrada/Reparación/Informes y KPIs, editor de repuestos tomado del catálogo de productos con totales, e informes agrupados (estado/cliente/equipo/repuesto) con export CSV. `npm run build` completó OK (chunk `TechnicalRepairs` 49.84 kB). No se realizó prueba visual automatizada en navegador; queda pendiente que el usuario valide el flujo completo en la UI.
