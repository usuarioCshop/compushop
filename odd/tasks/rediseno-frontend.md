# Feature: Rediseño frontend (Compushop)

Objetivo: mejorar la estética y el diseño del frontend de forma incremental,
con una secuencia sana (auditar → marca → design system → reemplazar → checklist).
Branch: `dev2`. Delivery: `ask-on-risk`. Verificación: `npm run dev` en frontend (5173) con backend 4000.

Principio de trabajo: un punto de la lista se cierra cuando está verificado y
commiteado; el estado se puede consultar en cualquier momento en este archivo
(y en el mirror de Engram, topic `odd/frontend-rediseno/tasks`).

## Specs

- S1 — Existe una auditoría escrita del frontend actual (páginas públicas + admin), con problemas observados por sección (no genéricos) y evidencia.
- S2 — Existe un mini-brief de marca: tono, colores (2–3 de marca), tipografía, radio, densidad. Sin ambigüedad para decidir UI.
- S3 — El design system en `frontend/src/theme/` sale de `frontend/src/theme/index.js`; botones, cards, inputs, badges y listas no hardcodean hex sueltos.
- S4 — Las páginas se reemplazan de mayor impacto a menor: Home → Catálogo → Detalle → Carrito/Checkout → Admin (usuarios, productos, dashboard).
- S5 — Cada cambio se verifica con checklist: contraste AA, estado vacío, estado error, loading, mobile 360px, modo oscuro. Y se commitea en `dev2`.

## Tasks

- [ ] T1 | S1 | Auditoría del frontend actual: páginas, theme, componentes, colores hardcodeados, responsive y modo oscuro | inline | pendiente
- [ ] T2 | S2 | Mini-brief de marca con el usuario: tono, colores, tipografía, radio, densidad | inline | pendiente
- [ ] T3 | S3 | Consolidar design system en theme/index.js (tokens, variantes, componentes comunes) sin romper lo existente | inline | pendiente
- [ ] T4 | S4 | Reemplazar/ajustar Home | inline | pendiente
- [ ] T5 | S4 | Reemplazar/ajustar Catálogo (Products + filtros) | inline | pendiente
- [ ] T6 | S4 | Reemplazar/ajustar Detalle de producto | inline | pendiente
- [ ] T7 | S4 | Reemplazar/ajustar Carrito y flujo de pedido | inline | pendiente
- [ ] T8 | S4 | Reemplazar/ajustar Admin (Usuarios, Productos, Dashboard) | inline | pendiente
- [ ] T9 | S5 | Checklist de calidad completo por cada cambio entregado (contraste, vacío, error, loading, 360px, oscuro); backup en commits separados | inline | pendiente

## Log

- L1: Pedido original (2026-11-06): "como crees que deberia seguir para entrar a trabajar con la estetica y diseño del frontend"
- L2: Se propuso secuencia de 5 etapas (auditar → marca → design system → reemplazar → checklist); el usuario está completamente de acuerdo.
- L3: Solicitud de seguimiento: lista de tareas con esos puntos para ir avanzando de a uno, consultable en cualquier momento. Este archivo es la fuente de verdad del estado; mirror en Engram (`odd/frontend-rediseno/tasks`).

## Para consultar el estado (preguntar al agente)

> "En qué estado estamos con el rediseño del frontend?" → responde mirando este archivo (Tasks) y el Log.
