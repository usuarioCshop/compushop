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
- [x] T3 | S2,S3,S5 | inline | F3: servicios WSAA/WSFE, mapeo alícuotas/cálculo fiscal, QR (port de `temp/src/arca` y `temp/src/invoice/calc` a CJS). Commit: pendiente (etapa verificada).
- [ ] T4 | S4,S5,S7 | inline | F4: API de emisión electrónica (validación, numeración ARCA, pending/approved/rejected, idempotencia básica) y endpoints de consulta/PDF fiscal.
- [ ] T5 | S6,S7 | inline | F5: PDF fiscal (A/B, CAE, QR) y UI `/facturacion` (tipo/concepto/receptor fiscal, emitir, estado, descarga).
- [ ] T6 | S8 | inline | F6: verificación homologación, hardening y documentación/runbook.

## Log
L1: "bien arranca y verificamos cada etapa antes del commit y continuar a la siguiente tarea" — análisis de `temp/` completado; iniciar implementación por fases con verificación y commit por etapa.
