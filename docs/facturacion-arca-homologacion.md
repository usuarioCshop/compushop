# Facturación electrónica ARCA (homologación y producción) - Compushop

Guía operativa del módulo de facturación electrónica integrado en Compushop (WSAA/WSFE, CAE, QR RG 4291).

## 1. Componentes implementados
- **Config/secretos**: `backend/src/config/arca.js`, variables en `backend/.env.example` (`ARCA_ENV`, `ARCA_CERT_PATH/KEY_PATH` o PEM, `EMISOR_CUIT`, `PTO_VTA`, etc.). Certificados/llaves fuera del repo (`.gitignore`).
- **DB**: `016_arca_tokens.sql` (cache de Ticket de Acceso WSAA) y `017_invoice_arca_fields.sql` (campos fiscales en `invoices`/`billing_clients`).
- **Servicios ARCA**: `backend/src/arca/wsaa.js` (loginCms, firma CMS, cache TA), `wsfe.js` (`FECompUltimoAutorizado`, `FECAESolicitar`), `fiscalCalc.js` (neto/IVA/alícuotas ARCA), `qr.js` (QR RG 4291).
- **API**: `POST /api/invoices/:id/arca-authorize` (valida, calcula, numera desde ARCA, solicita CAE, guarda `pending/approved/rejected`), PDF `/api/invoices/:id/pdf` con CAE/QR cuando está aprobado.
- **UI**: `/facturacion` permite guardar/emitir y autorizar comprobante (tipo A/B, concepto, doc/condición IVA receptor, fechas de servicio) y muestra estado/CAE/errores. Nombre de PDF fiscal: `factura-CAE-{CAE}.pdf` (o `factura-{número}.pdf` sin CAE).

## 2. Requisitos para homologación
1. Generar clave privada y CSR, obtener certificado de homologación en WSASS y autorizar servicio `wsfe`.
2. Configurar en `backend/.env` (o entorno): `ARCA_ENV=homologacion`, `ARCA_CERT_PATH` y `ARCA_KEY_PATH` (o `ARCA_CERT_PEM`/`ARCA_KEY_PEM`), `EMISOR_CUIT` y `PTO_VTA` habilitado en homologación. Completar datos fiscales del emisor en Ajustes.
3. Aplicar migraciones `013–017` en el entorno correspondiente.
4. Emitir comprobante de prueba desde `/facturacion` → detalle → **Autorizar ARCA** (Factura B, Consumidor Final suele ser el caso más simple).

## 3. Notas de funcionamiento
- **Numeración fiscal**: se obtiene con `FECompUltimoAutorizado + 1` al momento de autorizar. 0.2 (concurrencia/reintento/reconciliación ante timeouts en producción) está diferido en `mejoras1` hasta usar WS de producción.
- **Rechazos/pendientes**: si ARCA rechaza o hay error, el comprobante queda en `rejected`/error y puede corregirse y reintentarse; revisar observaciones. Ante timeout tras envío, reconciliar antes de reintentar para evitar duplicados.
- **Precios/IVA**: el cálculo fiscal usa base neta por línea y alícuotas soportadas (0, 2.5, 5, 10.5, 21, 27). Validar coherencia A/B y condición IVA del receptor (0.3 diferido en `mejoras1`).
- **Stock (0.4, pendiente verificación):** el stock se descuenta al facturar/emitir, al utilizar producto en servicio técnico, o en compras online pagadas con transferencia. Repuestos ya consumidos en servicio técnico se facturan en el detalle sin nuevo descuento; ítems pueden marcarse como “ya descontados” cuando corresponda.
- **Seguridad**: nunca commitear certificados, claves ni `.env`. Certificados no van a Blob. El endpoint requiere roles `superadmin/admin/tecnico`.

## 4. Limpieza de `arca_tokens` al cambiar de ambiente (F-E1)
La tabla `arca_tokens` cachea el Ticket de Acceso (TA) de WSAA por servicio (`wsfe`). El TA es específico del ambiente/certificado; al cambiar de homologación a producción (o viceversa), cambiar certificados/llaves o cambiar CUIT/contexto, **debe limpiarse** para forzar un nuevo login.

**Procedimiento (SQL, sobre la base del ambiente correspondiente):**
```sql
-- limpiar todos los tokens ARCA cacheados
DELETE FROM arca_tokens;
-- alternativa equivalente
-- TRUNCATE arca_tokens;
```

**Cuándo ejecutar:**
- Antes o inmediatamente después de cambiar `ARCA_ENV` (homologación ↔ producción).
- Al rotar o reemplazar certificado/clave privada.
- Si aparecen errores de autenticación WSAA tras un cambio de ambiente/configuración.

**Verificación:** emitir/autorizar un comprobante de prueba y confirmar que WSAA genera un nuevo TA sin errores.

## 5. Runbook: paso a producción (F-E2)

### 5.1 Prerrequisitos
- Certificado y clave privada de **producción** emitidos en ARCA/AFIP, con servicio `wsfe` autorizado/delegado para el CUIT emisor.
- Punto de venta (`PTO_VTA`) habilitado en producción para factura electrónica.
- Datos fiscales del emisor completos y correctos (CUIT, razón social, condición IVA, domicilio, IIBB, inicio de actividades).
- Migraciones `013–017` aplicadas en la base de producción.
- 0.2 (numeración/concurrencia/timeouts en WS producción) y 0.3 (reglas fiscales/totales) revisados según corresponda antes de operar en producción.

### 5.2 Variables de entorno (Vercel u hosting del backend)
Configurar (nunca commitear valores reales):
- `ARCA_ENV=production`
- `ARCA_CERT_PEM` y `ARCA_KEY_PEM` (PEM completos, con `-----BEGIN/END-----`; en env vars los saltos pueden ir como `\n`) **o** rutas `ARCA_CERT_PATH`/`ARCA_KEY_PATH` en VPS con permisos restringidos.
- `EMISOR_CUIT` (CUIT del emisor)
- `PTO_VTA` (punto de venta habilitado)
- Datos fiscales complementarios según `backend/.env.example` y configuración en Ajustes.
- `DATABASE_URL_UNPOOLED` / conexión de backend apuntando a la base de producción migrada.

> No usar Blob para certificados/llaves. En VPS, restringir permisos de archivos de clave.

### 5.3 Checklist de despliegue
1. **Backup/precaución:** confirmar acceso a la base y plan de rollback de configuración (no de comprobantes aprobados).
2. **Migraciones:** verificar `001–017` aplicadas en producción (`npm run migrate:status`).
3. **Limpiar tokens:** ejecutar `DELETE FROM arca_tokens;` al pasar a producción o al cambiar credenciales.
4. **Configurar variables:** cargar PEM/cert, `ARCA_ENV=production`, `EMISOR_CUIT`, `PTO_VTA` y datos fiscales.
5. **Redeploy:** desplegar backend/frontend con la nueva configuración.
6. **Verificación post-deploy:**
   - Abrir `/facturacion` y confirmar que el módulo carga.
   - Emitir un comprobante de prueba controlado (según estrategia fiscal definida) y validar: CAE asignado, estado aprobado, PDF con CAE/QR y nombre `factura-CAE-{CAE}.pdf`.
   - Probar un caso de rechazo controlado (si aplica) y verificar observaciones.
7. **Monitoreo inicial:** revisar logs (Vercel Runtime Logs / servidor) ante primeras emisiones.

### 5.4 Cambio de ambiente (homologación ↔ producción)
1. Actualizar `ARCA_ENV`, certificados/llaves, `EMISOR_CUIT` y `PTO_VTA` del ambiente destino.
2. Ejecutar `DELETE FROM arca_tokens;` en la base de ese ambiente.
3. Redeploy/reinicio del backend.
4. Emitir comprobante de prueba del ambiente destino.

## 6. Irreversibilidad de comprobantes aprobados (F-E3)
- **Los comprobantes aprobados por ARCA (con CAE asignado) son fiscalmente irreversibles** en el sentido de que no pueden “des-aprobarse” ni eliminarse del registro fiscal.
- La anulación/corrección en el sistema y ante ARCA/AFIP debe seguir la normativa y el procedimiento vigente (p. ej. notas de crédito u otros mecanismos habilitados, según el caso). No asumir que “anular” en la UI revierte el efecto fiscal de un CAE aprobado.
- Operar con controles previos a la emisión (datos de receptor, tipo A/B, importes, concepto, punto de venta) y tratar la autorización como acción sensible.

## 7. Pendientes y referencias
- Pendientes operativos/técnicos vigentes en `mejoras1` (Engram, topic `mejoras1/backlog`): 0.2 diferido hasta WS producción, 0.3 diferido, 0.4 implementado pendiente verificación (F-D4), 0.6 integración.
- Tareas históricas: `odd/tasks/facturacion.md`, `odd/tasks/facturacion-arca.md`.
- Implementación PDF fiscal actual: `backend/src/controllers/invoicesController.js` (`getPdf`). `backend/scripts/pdf.js` (referencia antigua no utilizada) fue removido en F-E4 para evitar confusión.
