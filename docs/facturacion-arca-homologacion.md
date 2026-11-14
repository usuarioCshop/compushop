# Facturación electrónica ARCA (homologación) - Compushop

Basado en `temp/` (proyecto de referencia funcional) e integrado al módulo de facturación existente.

## Componentes implementados
- **Config/secretos**: `backend/src/config/arca.js`, variables en `backend/.env.example` (`ARCA_ENV`, `ARCA_CERT_PATH/KEY_PATH` o PEM, `EMISOR_CUIT`, `PTO_VTA`, etc.). Certificados/llaves fuera del repo (`.gitignore`).
- **DB**: `016_arca_tokens.sql` (cache WSAA) y `017_invoice_arca_fields.sql` (campos fiscales en `invoices`/`billing_clients`).
- **Servicios ARCA**: `backend/src/arca/wsaa.js` (loginCms, firma CMS, cache TA), `wsfe.js` (`FECompUltimoAutorizado`, `FECAESolicitar`), `fiscalCalc.js` (neto/IVA/alícuotas ARCA), `qr.js` (QR RG 4291).
- **API**: `POST /api/invoices/:id/arca-authorize` (valida, calcula, numera desde ARCA, solicita CAE, guarda `pending/approved/rejected`), PDF `/api/invoices/:id/pdf` con CAE/QR cuando está aprobado.
- **UI**: `/facturacion` permite autorizar comprobante (tipo A/B, concepto, doc/condición IVA receptor, fechas servicio) y muestra estado/CAE/errores.

## Requisitos para homologación
1. Generar clave privada y CSR, obtener certificado de homologación en WSASS y autorizar servicio `wsfe` (ver `temp/certs/Certificado de homologación ARCA del CSR a la verificación.md`).
2. Configurar en `backend/.env` (o entorno): `ARCA_ENV=homologacion`, `ARCA_CERT_PATH`, `ARCA_KEY_PATH` (o PEM), `EMISOR_CUIT` y `PTO_VTA` habilitado en homologación. Completar datos fiscales del emisor en Ajustes.
3. Aplicar migraciones 016–017 en el entorno correspondiente.
4. Emitir comprobante de prueba desde `/facturacion` → detalle → **Autorizar ARCA** (Factura B, Consumidor Final suele ser el caso más simple).

## Notas importantes
- **Numeración fiscal**: se obtiene con `FECompUltimoAutorizado + 1` al momento de autorizar; manejar concurrencia/reintentos si hay emisiones simultáneas.
- **Rechazos/pendientes**: si ARCA rechaza o hay error, el comprobante queda en `rejected`/error y puede corregirse y reintentarse; revisar observaciones. En timeouts tras envío, reconciliar antes de reintentar para evitar duplicados.
- **Precios/IVA**: el cálculo fiscal usa precio unitario como base neta por línea y alícuotas soportadas (0, 2.5, 5, 10.5, 21, 27). Validar coherencia A/B y condición IVA del receptor.
- **Producción**: usar certificado/`PTO_VTA` productivos, `ARCA_ENV=production`, delegar `wsfe`, limpiar `arca_tokens` al cambiar de ambiente (`DELETE FROM arca_tokens;`), y considerar que comprobantes aprobados son irreversibles.
- **Seguridad**: nunca commitear certificados, claves ni `.env`. El endpoint requiere roles `superadmin/admin/tecnico`.
