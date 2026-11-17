# Facturación electrónica ARCA (homologación)

## Header
- Objetivo: integrar facturación electrónica con ARCA/AFIP (WSAA + WSFEv1) en homologación, basado en `temp/`, para emitir comprobantes autorizados con CAE, QR y PDF fiscal desde el módulo de facturación existente.
- Rama: facturacion
- Estrategia de entrega: ask-on-risk
- Runner de tests: node --test (destructivo si se corre completo; no ejecutar sin aviso)

## Specs
S1. Ambiente homologación configurable (`ARCA_ENV=homologacion` por defecto), credenciales/certificados por env/rutas PEM, sin commitear secretos.
S2. Autenticación WSAA: firma CMS (cert+key), `loginCms`, cache de `token/sign` en DB (`arca_tokens`) con expiración/reutilización.
S3. WSFEv1: `FECompUltimoAutorizado` y `FECAESolicitar` para comprobantes (Factura A=1, B=6), concepto 1/2/3, con manejo de errores/observaciones.
S4. Modelo fiscal: persistir datos ARCA por comprobante (pto_vta, cbte_tipo, cbte_numero, concepto, receptor fiscal, totales/alícuotas, estado `pending|approved|rejected`, CAE, CAE vto, errores), vinculado al flujo interno; numeración fiscal desde ARCA con concurrencia segura.
S5. Cálculo y validaciones fiscales en servidor: neto/IVA/alícuotas (Ids ARCA), redondeo 2 dec, reglas A/B (A: CUIT receptor RI/Monotributo habilitado; B: no a RI), doc/condición IVA, fechas de servicio si concepto != 1.
S6. QR oficial (RG 4291) y PDF fiscal con CAE/vencimiento para comprobantes aprobados.
S7. API y UI en `/facturacion`: configuración/emisor fiscal, selección de tipo/concepto/receptor fiscal, emisión electrónica, visualización de estado/CAE/errores y descarga PDF fiscal. Permisos superadmin/admin/tecnico.
S8. Homologación verificable end-to-end con cert/pto vta de prueba; runbook para producción.

## Tasks
- [x] T1 | S1 | inline | F1: deps (`fast-xml-parser`,`node-forge`,`qrcode`) y configuración ARCA (`config`, `.env.example`, gitignore certs). Commit: `e895e70`.
- [x] T2 | S2,S4 | inline | F2: migraciones `arca_tokens` y campos/tablas fiscales en facturación + KNOWN_TABLES. Commit: `82a700a`.
- [x] T3 | S2,S3,S5 | inline | F3: servicios WSAA/WSFE, mapeo alícuotas/cálculo fiscal, QR (port de `temp/src/arca` y `temp/src/invoice/calc` a CJS). Commit: `2c8d6d6`.
- [x] T4 | S4,S5,S7 | inline | F4: API de emisión electrónica (validación, numeración ARCA, pending/approved/rejected, idempotencia básica) y endpoints de consulta/PDF fiscal. Commit: `ba7f989` (etapa verificada: endpoint + validaciones; requiere cert/CUIT/PTO para emisión real).
- [x] T5 | S6,S7 | inline | F5: PDF fiscal (A/B, CAE, QR) y UI `/facturacion` (tipo/concepto/receptor fiscal, emitir, estado, descarga). Commit: `ad2ac81`.
- [x] T6 | S8 | inline | F6: documentación/runbook completada (homologación + paso a producción, limpieza `arca_tokens`, irreversibilidad CAE, checklist deploy). Verificación E2E homologación parcial realizada en pruebas previas (F-A1..F-A6 correctos según mejoras1 0.1; F-A4 mejora futura; F-A7 evidencia pendiente). E2E completo/ajustes finos y operación en WS producción: pendientes/diferidos según mejoras1 (0.2, 0.3, F-D4).

## Log
L1: "bien arranca y verificamos cada etapa antes del commit y continuar a la siguiente tarea" — análisis de `temp/` completado; iniciar implementación por fases con verificación y commit por etapa.

L2 (2026-11-17): mejoras1 0.4 implementado F-D2/F-D3 (descuento/validación de stock al emitir y al aprobar ARCA desde borrador, reglas de repuestos ya descontados y prevención de doble facturación de reparación) pendiente verificación/E2E (F-D4 diferido). mejoras1 0.5 completado: `docs/facturacion-arca-homologacion.md` ampliado con F-E1/F-E2/F-E3 y referencia de implementación PDF; eliminado `backend/scripts/pdf.js` (F-E4). 0.2 y 0.3 diferidos. 0.6: tareas ODD actualizadas; migraciones 001-017 verificadas aplicadas en base configurada (`migrate:status` sobre DATABASE_URL_UNPOOLED); variables ARCA/deploy en Vercel y verificación en destino final quedan a cargo del usuario antes de merge/deploy definitivo.
