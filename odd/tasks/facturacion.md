# Facturación

## Header
- Objetivo: implementar módulo de facturación que permita facturar desde clientes/productos/reparaciones, con permisos para superadmin, admin y técnico, numeración correlativa ascendente, estados borrador/emitida/anulada, datos fiscales desde configuración y clientes propios con importación desde servicio técnico/compras online, cálculo de impuestos según corresponda, totales en ARS con redondeo 2 decimales y generación de PDF. Técnico puede ver todas las facturas.
- Rama: facturacion (derivada de dev2)
- Estrategia de entrega: ask-on-risk
- Runner de tests: node --test (destructivo si se corre completo; no ejecutar sin aviso)

## Specs
S1. Acceso: superadmin, admin y técnico pueden acceder y ver **todas** las facturas.
S2. Tipo de comprobante: Factura de venta (comprobante interno). Numeración correlativa ascendente, única y no reutilizable.
S3. Estados: `borrador`, `emitida`, `anulada`. Solo borradores editables/eliminables; emitida/anulada bloqueadas. Anulación registra fecha/motivo/usuario.
S4. Emisor: datos fiscales tomados de **tabla de configuración**. Si faltan campos, agregarlos (razón social, CUIT, domicilio, condición IVA, IIBB, inicio actividades, contacto, logo).
S5. Receptor: datos tomados de **clientes propios de facturación** (tabla propia). Búsqueda/alta puede **importar** desde clientes de servicio técnico (`repair_clients`) o desde clientes registrados en compras online (`users`/pedidos). El comprobante guarda **snapshot** del receptor y del emisor.
S6. Orígenes de ítems: **productos** y **reparaciones** (y línea manual si aplica). Puede haber ítems combinados.
S7. Impuestos según corresponda: productos con alícuota IVA del producto; reparaciones respetando **IVA de mano de obra opcional/configurable** (`labor_iva_enabled`/`labor_iva_rate`) y alícuotas de repuestos; línea manual con alícuota configurable. Cálculo y redondeo siempre en servidor, ARS, **2 decimales**.
S8. Moneda/formato: ARS, redondeo 2 decimales.
S9. PDF: generar PDF del comprobante, distinguible para borrador/emitida/anulada.
S10. Snapshot: al emitir/guardar, se guardan snapshots (precios/descripciones/datos fiscales) para mantener integridad histórica.

## Tasks
- [x] T1 | S1,S4 | inline | Ajustes: campos fiscales emisor en settings, controller y UI AdminSettings. (migración 013)
- [x] T2 | S5 | inline | `billing_clients` + búsqueda/importación desde repair_clients y usuarios/pedidos online. (migración 014)
- [x] T3 | S2,S3,S8,S10 | inline | Migraciones `invoices` e `invoice_items` con numeración, estados, snapshots, totales/impuestos, vínculos. (migración 015)
- [x] T4 | S1 | inline | Permisos/rutas para superadmin/admin/técnico (`requireTecnico`) con acceso total.
- [x] T5 | S2,S3,S6,S7 | inline | API: listado/detalle, next-number, CRUD borrador, precarga producto/reparación, emitir/anular, recálculo servidor (ARS 2 dec).
- [x] T6 | S9 | inline | PDF con pdfkit + endpoint `/invoices/:id/pdf` (marca borrador/anulada).
- [x] T7 | S1,S6,S7 | inline | Frontend `/facturacion`: listado, alta/edición borrador, importación receptor, ítems desde producto/reparación/manual, totales, detalle, emitir/anular, PDF.
- [ ] T8 | S7,S8 | inline | Validaciones extra, reglas de stock/doble facturación (si aplica), pruebas manuales/E2E y ajustes.

## Log
L1: "genera una lista de tareas para los siguientes puntos. La facturacion puede realizarce por superadmin, admin y tecnico, la seccion de facturacion debe tomar los datos de clientes, productos o reparaciones y debe generar pdf." + definiciones: tipo de comprobante a detallar (Factura de venta), emisor desde tabla configuración con campos faltantes si aplica, receptor desde tabla propia de facturación con importación desde servicio técnico o compras online, impuestos según casos, numeración correlativa ascendente, estados los 3, origen ítems de ambos, ARS redondeo 2 decimales, resto confirmado, técnico puede ver todas las facturas.
L2: Implementado MVP de facturación (T1-T7). Migraciones 013-015 aplicadas en test DB; backend reiniciado; frontend build OK. Pendiente T8: pruebas manuales, reglas de stock/doble facturación y ajustes finos.
