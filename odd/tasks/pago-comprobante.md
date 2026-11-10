# Forma de pago y comprobante en checkout

Rama: `feature-pago` (desde `frontend-rediseno`). Alcance: carrito/checkout, pedido y admin. Persistencia en DB (test primero).

## Objetivo
Permitir elegir forma de pago (Transferencia / Efectivo) en el carrito, mostrar alias CBU y cargar comprobante de transferencia, guardando la información en el pedido.

## Decisiones (cerradas)
- **D1:** Alias **"ALIAS DEL CBU compushopvo.mp"** y carga de comprobante se muestran **solo cuando se elige "Transferencia"**. En "Efectivo" se ocultan/no se piden.
- **D2:** Comprobante admite **imagen (jpg/png/webp/gif)** y **PDF**.
- **D3:** El comprobante **no es obligatorio**. Si el usuario no pudo subirlo, debe marcar un **checkbox** indicando "No se pudo subir el comprobante" y ese estado debe quedar **registrado en la BD** (campo dedicado, ej. `payment_receipt_pending`/flag).

## Tareas

- [x] T0.a | Entorno: `.env` local apuntando a rama test (`ep-odd-tree-b6vi1fsh`) — app y unpooled. Backend reiniciado y verificado en test (2026-11-10).
- [x] T0.b | Decisiones D1–D3 cerradas con el usuario.
- [x] T1 | Migración DB (test): agregados en `orders` `payment_method` (CHECK transferencia|efectivo), `payment_receipt_url` (TEXT nullable) y `payment_receipt_pending` (boolean NOT NULL DEFAULT false). Aplicada con `npm run migrate` en rama test (2026-11-10). (Producción: al deploy, autorizado por el usuario.)
- [x] T2 | Backend: upload de comprobante para checkout (público/optionalAuth, validación tipo imagen/PDF y tamaño), reutilizando Vercel Blob / `/uploads`. Actual `/api/upload` es admin-only e imagen-only.
- [x] T3 | Backend: `ordersController.create` acepta/valida/persiste `payment_method`, `payment_receipt_url`, `payment_receipt_pending` según D1/D3; exponerlos en respuestas.
- [x] T4 | Frontend `Cart.jsx`: select forma de pago; si Transferencia mostrar alias "ALIAS DEL CBU compushopvo.mp", upload (img/PDF) y checkbox "No se pudo subir el comprobante" (comprobante no obligatorio). Enviar datos en `POST /orders`.
- [x] T5 | Admin: mostrar forma de pago, comprobante (link/preview si imagen; link si PDF) y estado "comprobante pendiente/no subido" en detalle de pedido.
- [x] T6 | Verificación en test (efectivo; transferencia con comprobante; transferencia sin comprobante + checkbox marcado), doc/log y commit.

## Riesgos / notas
- Migraciones y escrituras solo contra **test**; aplicar en producción es acción del usuario al deploy.
- Upload público: limitar tipo y tamaño.
- No commitear secretos.

## Log
- L1 (2026-11-10): Pedido del usuario (persistir forma de pago y comprobante). `.env` local pasado a test; backend verificado en `ep-odd-tree-b6vi1fsh`. Rama `feature-pago` creada. Doc de tareas creado. Pendiente cerrar D1-D3 antes de implementar.

- L2 (2026-11-10): D1-D3 cerradas. D1: alias y comprobante solo si Transferencia. D2: imagen y PDF. D3: comprobante no obligatorio; checkbox "no se pudo subir" debe quedar registrado en BD.

- L3 (2026-11-10): T1 en progreso: creada `backend/src/db/migrations/008_order_payment.sql`. `npm run migrate` falló porque `DATABASE_URL_UNPOOLED` en `.env` no es una URL válida (la app usa `DATABASE_URL` pooled y está OK en test). Requiere corregir `DATABASE_URL_UNPOOLED` a la URL directa de `ep-odd-tree-b6vi1fsh` y reintentar.

- L4 (2026-11-10): T1 completada. Migración `008_order_payment.sql` aplicada en test (ep-odd-tree-b6vi1fsh).

- L5 (2026-11-10): T2-T5 implementadas (upload /api/upload/receipt img+PDF; orders create persiste metodo/comprobante/pendiente; Cart con select/alias/upload/checkbox; AdminOrders muestra pago y comprobante). Pendiente T6 verificación manual en test.

- L6 (2026-11-10): Stock por forma de pago: transferencia descuenta al confirmar; efectivo descuenta al pasar a entregado (y se ajusta al cancelar/reabrir según corresponda).

- L7 (2026-11-10): T6 verificada y confirmada por el usuario. Funcionalidad de pago/comprobante y regla de stock por forma de pago OK.
