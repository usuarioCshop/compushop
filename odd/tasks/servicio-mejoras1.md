# Servicio — mejoras 1 (Bloque 1)

## Header
- Objetivo: mejorar flujo de Servicio Técnico en rama `servicio` (derivada de `dev2`): permitir crear técnico desde modal al asignar, crear producto/repuesto desde modal al cargar repuestos, y facturar servicio desde Historial de Órdenes (Acciones).
- Rama: servicio (derivada de origin/dev2)
- Estrategia de entrega: ask-on-risk
- Runner de tests: node --test backend (destructivo si se corre completo; no ejecutar sin aviso). Frontend: build/vite según corresponda.

## Specs
S1. En asignación de técnico (Entrada de Servicio Técnico), si el técnico no existe, ofrecer posibilidad de crearlo desde un modal, con datos mínimos y validaciones; al crearlo queda disponible y seleccionable en el flujo.
S2. En carga de repuestos de reparación, si el producto/repuesto no figura, ofrecer opción de crearlo desde un modal (datos mínimos según reglas de producto/stock); al crearlo queda disponible en el catálogo/selector y puede usarse en la reparación.
S3. En Historial de Órdenes (Servicio Técnico) → Acciones, agregar opción para facturar el servicio, precargando datos de la reparación/cliente/ítems en facturación según flujo disponible. Respetar permisos y evitar doble facturación cuando aplique (según capacidades actuales del módulo de facturación).
S4. Permisos y consistencia: cambios accesibles para roles que usan Servicio Técnico (`tecnico`, `admin`, `superadmin`) según corresponda; no romper flujos existentes.

## Tasks
- [x] T1 | S1,S4 | inline | Implementado (pendiente verificación): `POST /technical-repairs/technicians` (alta rápida rol técnico, requireTecnico) y modal “Crear técnico” en `EntradaTab` con selección automática del técnico creado.
- [x] T2 | S2,S4 | inline | Implementado (pendiente verificación): `POST /technical-repairs/parts-catalog` (alta rápida producto/repuesto activo) y modal “Crear repuesto” en `RepairPartsEditor` con agregado automático a la reparación.
- [x] T3 | S3,S4 | inline | Implementado (pendiente verificación): acción “Facturar servicio” en `HistoricoTab` navega a `/facturacion?preloadRepair=<id>` e `Invoicing` precarga la reparación. Nota: rama `servicio` parte de `origin/dev2` y no incluye últimos commits 0.4/0.5/0.6 de `facturacion`.
- [ ] T4 | S1-S4 | inline | Verificación básica (sintaxis/build/manual dirigida), ajustes y registro de pendientes.

## Log
L1 (2026-11-17): "ok arranquemos el bloque 1(Servicio)" — inicio Bloque 1 mejoras1 en rama `servicio` creada desde `origin/dev2` (dev2 incluye merge de facturación #23; últimos commits 0.4/0.5/0.6 de `facturacion` no están en esta rama). Tareas: crear técnico desde modal, crear producto/repuesto desde modal, facturar servicio desde Historial de Órdenes.

L2 (2026-11-17): Implementados T1-T3. Backend: endpoints POST `/technical-repairs/technicians` y `/technical-repairs/parts-catalog`. Frontend: modal crear técnico en `EntradaTab`, modal crear repuesto en `RepairPartsEditor`, acción facturar en `HistoricoTab` y precarga por query param en `Invoicing`. Verificado: `node --check` backend ok y `vite build` frontend ok. Pendiente T4 (pruebas manuales/ajustes) y considerar merge/cherry-pick de mejoras recientes de facturación (0.4) para consistencia de stock al facturar servicios.
