# Servicio — mejoras 1 (Bloque 1)

## Header
- Objetivo: mejorar flujo de Servicio Técnico: permitir crear técnico desde modal al asignar, crear producto/repuesto desde modal al cargar repuestos, facturar servicio desde Historial de Órdenes (Acciones) y ajustar numeración de órdenes.
- Rama de trabajo: `servicio` (desde `origin/dev2`), integrada para pruebas en `test` (merge de `servicio` + `origin/facturacion` 0.4/0.5/0.6).
- Estrategia de entrega: ask-on-risk
- Runner de tests: node --test backend (destructivo si se corre completo; no ejecutar sin aviso). Frontend: build/vite según corresponda.

## Specs
S1. En asignación de técnico (Entrada de Servicio Técnico), si el técnico no existe, ofrecer posibilidad de crearlo desde un modal, con datos mínimos y validaciones; al crearlo queda disponible y seleccionable en el flujo.
S2. En carga de repuestos de reparación, si el producto/repuesto no figura, ofrecer opción de crearlo desde un modal (datos mínimos según reglas de producto/stock); al crearlo queda disponible en el catálogo/selector y puede usarse en la reparación.
S3. En Historial de Órdenes (Servicio Técnico) → Acciones, agregar opción para facturar el servicio, precargando datos de la reparación/cliente/ítems en facturación según flujo disponible. Respetar permisos y evitar doble facturación cuando aplique (según capacidades actuales del módulo de facturación).
S4. Permisos y consistencia: cambios accesibles para roles que usan Servicio Técnico (`tecnico`, `admin`, `superadmin`) según corresponda; no romper flujos existentes.

## Tasks
- [x] T1 | S1,S4 | inline | Verificado (manual): `POST /technical-repairs/technicians` (requireTecnico) y modal “Crear técnico” en `EntradaTab` con selección automática. Acceso, validaciones, alta, persistencia, duplicados y permisos OK.
- [x] T2 | S2,S4 | inline | Verificado (manual): `POST /technical-repairs/parts-catalog` y modal “Crear repuesto” en `RepairPartsEditor` con agregado automático. Alta, guardado/cálculos, reuso y regresión de repuestos OK; descuento de stock verificado al facturar.
- [x] T3 | S3,S4 | inline | Verificado (manual, lado Servicio): acción “Facturar servicio” en `HistoricoTab` navega a `/facturacion?preloadRepair=<id>` e `Invoicing` precarga orden/cliente/ítems correctos. Emisión/ARCA corresponde a módulo Facturación.
- [x] T4 | S1-S4 | inline | Verificado (manual): numeración de órdenes `AAAA-MM-#######` (incremental por mes), regresión general de Servicio Técnico OK. Observación: informes deseados en PDF y mejoras futuras.

## Log
L1 (2026-11-17): "ok arranquemos el bloque 1(Servicio)" — inicio Bloque 1 mejoras1 en rama `servicio` creada desde `origin/dev2` (dev2 incluye merge de facturación #23; últimos commits 0.4/0.5/0.6 de `facturacion` no están en esta rama). Tareas: crear técnico desde modal, crear producto/repuesto desde modal, facturar servicio desde Historial de Órdenes.

L2 (2026-11-17): Implementados T1-T3. Backend: endpoints POST `/technical-repairs/technicians` y `/technical-repairs/parts-catalog`. Frontend: modal crear técnico en `EntradaTab`, modal crear repuesto en `RepairPartsEditor`, acción facturar en `HistoricoTab` y precarga por query param en `Invoicing`. Verificado: `node --check` backend ok y `vite build` frontend ok. Pendiente T4 (pruebas manuales/ajustes) y considerar merge/cherry-pick de mejoras recientes de facturación (0.4) para consistencia de stock al facturar servicios.
L3 (2026-11-18): Para pruebas se creó rama `test` desde `origin/dev2` y se mergearon `servicio` (commit T1-T3) y `origin/facturacion` (0.4/0.5/0.6). BD de pruebas: `ep-odd-tree-b6vi1fsh-pooler.../neondb` (ARCA homologación). Correcciones durante pruebas: fix `toLowerCase()` en alta rápida de técnico; numeración de órdenes a `AAAA-MM-#######` incremental por mes (`getNextTicket`/creación); `fetchRepairWithParts` ahora incluye `parts` en la respuesta; `ReparacionTab` recarga detalle tras guardar y mapea repuestos de forma defensiva.

L4 (2026-11-18): Pruebas manuales de Servicio completadas: T1 OK; T2 OK (incluye guardado/cálculo/recarga de repuestos, reuso y regresión; stock descuenta al facturar); T3 lado Servicio OK (acción, navegación y precarga correcta); T4/regresión general OK. Observaciones: informes se desea exportar en PDF y realizar mejoras futuras; D-2 (vínculo/estado orden↔factura e idempotencia) sigue pendiente. Cambios en `test` sin commit (backend `technicalRepairsController.js`, frontend `ReparacionTab.jsx`; `odd/tasks/servicio-mejoras1.md` actualizado).
