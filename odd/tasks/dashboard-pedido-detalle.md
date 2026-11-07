# Dashboard: detalle de pedido

Rama: `frontend-rediseno`. Alcance acotado (admin).

## Objetivo
Ver el detalle de un pedido desde el dashboard/admin para saber qué productos/servicios lo integran.

## Alcance
- Sección de pedidos en admin/dashboard.
- Mostrar ítems del pedido (producto/servicio, cantidad, precio unitario/subtotal) y total.
- Checkbox por ítem para marcar preparado (preparación del pedido). Persistencia en `localStorage` del navegador; se borra al guardar el pedido con estado `shipped`.
- Ajustar endpoint/datos del backend solo si es necesario para exponer el detalle.
- Fuera de alcance: checkout/carrito del cliente, cambios de flujo de compra, persistencia en backend/DB.

## Criterio de aceptación
- Desde la lista de pedidos se puede abrir un pedido y ver sus ítems y totales.
- Funciona con datos reales; no rompe la lista actual.

## Verificación
- Prueba manual en `localhost:5173` (admin, pedidos).
- Revisar respuesta del endpoint de detalle si se modifica.

## Log
- L1 (2026-11-07): Pedido del usuario. Documentado como tarea acotada; trabajo en `frontend-rediseno`. Pendiente análisis e implementación.

- L2 (2026-11-07): Implementado en `AdminOrders.jsx`: botón "Ver detalle" (ícono ojo) que abre modal, carga `GET /api/orders/:id` y muestra cliente, ítems (nombre, tipo, cantidad, precio, subtotal) y total. Backend ya exponía items en getOne; sin cambios de backend. Compila (esbuild). Pendiente QA visual con usuario admin.

- L3 (2026-11-07): Alcance ampliado (confirmado por usuario): checkbox por ítem para preparación, persistido en `localStorage` hasta que el pedido se guarda como `shipped`. Sin cambios de backend/DB.

- L4 (2026-11-07): Checkbox "Listo" por ítem en modal de detalle, guardado en `localStorage` (`compushop_order_prep_<orderId>`). Se limpia al cambiar estado a `shipped`. Compila (esbuild). Pendiente QA visual.
