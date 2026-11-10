# Servicio Técnico — órdenes de reparación

Objetivo: sección de servicio técnico accesible solo por el rol `tecnico`, con interfaz tipo gestión de boletas de reparación (boleta, cliente, artículo, daño reportado, imagen, fecha probable de reparación, listado de boletas). Rama `feature-ser-tec` desde `dev2`. Test runner: backend (supertest/jest si existe, de lo contrario curl contra `localhost:4000`) + frontend (vite en `localhost:5173`).

## Specs
- S1: Rol `tecnico` disponible en `users.role` (actualizar CHECK de `admin|customer` a `admin|customer|tecnico`).
- S2: Tabla `technical_repairs` con: `ticket_number`, `status` (pendiente/en_proceso/reparado/entregado/cancelado), `received_at`, `client_name`, `client_address`, `client_id`, `client_email`, `client_phone`, `article`, `brand`, `model`, `serial_number`, `damage_reported`, `notes`, `image_url`, `probable_repair_date`, `created_at`, `updated_at`.
- S3: Endpoint `GET /api/technical-repairs` (listar, solo técnico/admin).
- S4: Endpoint `POST /api/technical-repairs` (crear, solo técnico/admin).
- S5: Endpoints `GET/PUT/DELETE /api/technical-repairs/:id` (solo técnico/admin).
- S6: Endpoint `POST /api/upload/repair-image` (subir imagen del equipo, solo técnico/admin).
- S7: Middleware `requireTecnico` que proteja las rutas de técnico.
- S8: Frontend página `/tecnico` con interfaz similar a la imagen de referencia, protegida por rol `tecnico` (y admin para supervisión).
- S9: `AuthContext` expone `isTecnico`.

## Tasks
- T1 | S1,S2 | inline | migración 009 (`users.role` + `technical_repairs`) | completada
- T2 | S7 | inline | middleware `requireTecnico` | completado
- T3 | S3,S4,S5,S6 | inline | rutas backend `/api/technical-repairs` y `/api/upload/repair-image` | completadas
- T4 | S3-S6 | inline | controlador `technicalRepairsController` | completado
- T5 | S9 | inline | `AuthContext.isTecnico` | pendiente
- T6 | S8 | inline | frontend página `/tecnico` (listado + formulario) | pendiente
- T7 | S8 | inline | registro de rutas en `App.jsx` y enlace en Navbar | pendiente
- T8 | S1-S9 | inline | verificación en test (crear/listar/editar reparación con imagen) | pendiente

## Log
- L1 (2026-11-10): Usuario solicita sección de servicio técnico solo para rol Técnico, interfaz tipo gestión de boletas de reparación (imagen de referencia). Rama `feature-ser-tec` creada desde `dev2`.

- L2 (2026-11-10): Backend de servicio técnico funcionando (migración 009, middleware requireTecnico, rutas y controlador). Endpoints probados con rol tecnico: create/list OK.
