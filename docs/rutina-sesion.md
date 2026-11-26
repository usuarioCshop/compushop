# Rutina de sesión (Compushop)

Procedimientos acordados para cerrar y retomar el trabajo de forma segura.

- **Proyecto:** `/mnt/d/2026/aplicacion negocio/compushop`
- **Regla:** no ejecutar `npm test`, `npm run seed` ni acciones destructivas contra BD sin confirmación explícita. Usar BD de prueba/local para validaciones manuales.

## “Hasta mañana” — cierre y despedida

Cuando el usuario diga **"hasta mañana"**:

1. **Servidores en ejecución:** recordar detener backend/frontend (`npm run dev`) con `Ctrl+C` en cada terminal y esperar a que finalicen.
2. **Estado del repo:** ejecutar `git status --short` (y `git branch --show-current`) en el proyecto; reportar si hay cambios sin intención. No commitear ni hacer push salvo pedido explícito.
3. **Registro:** si hubo avances/validaciones/decisiones en la sesión, actualizar el ODD/log correspondiente (p. ej. `odd/tasks/caja-mejoras1.md`) y/o notas acordadas.
4. **Memoria (Engram):** guardar `mem_session_summary` del proyecto `compushop` con objetivo, avances, hallazgos, próximos pasos y archivos relevantes (antes de la despedida).
5. **Cierre:** indicar que se puede cerrar terminales/editor con seguridad y despedirse brevemente.

## “Buen día” — preparación y arranque

Cuando el usuario diga **"buen día"**:

1. **Ubicación y git:** trabajar en `/mnt/d/2026/aplicacion negocio/compushop`; verificar `git branch --show-current`, `git status --short` y (si aporta) `git log --oneline -5`.
2. **Recuperar contexto (Engram):** usar `mem_context`/`mem_search` para el proyecto `compushop` y revisar el ODD/tarea activa (`odd/tasks/caja-mejoras1.md`, S10/T11-T15: implementado; commits `1343d73` y `77b67f0` en `test` pusheados; migraciones 018-021 aplicadas en prod; migración 022 aplicada en test y en prod (aditiva, aplicada sin confirmación explícita). Validado: T14 OK, Sección 3 reparación cobrado s/facturación casos 1-3 OK, Sección 3 factura emitir/anular/doble facturación OK. Pendiente: Sección 3 pedido cobrado/cancelado; Sección 4 según checklist).
3. **Prerrequisitos (sin leer secretos):** confirmar `backend/node_modules` y `frontend/node_modules`; recordar que backend requiere `.env` con `DATABASE_URL` (BD de prueba/local para validación) y que migraciones deben estar al día (`npm run migrate`/`migrate:status` si hace falta).
4. **Levantar entorno (manual, en terminales del usuario):**
   - Backend: `cd backend && npm run dev` (puerto 4000).
   - Frontend: `cd frontend && npm run dev` (puerto 5173, proxy `/api`).
   - Verificar contra BD de prueba/local (nunca producción ni `TEST_DATABASE_URL` de suite destructiva para pruebas manuales).
5. **Resumen y siguiente paso:** informar estado actual (rama, limpio/cambios, contexto recuperado) y proponer retomar desde el próximo punto pendiente del checklist o la tarea prioritaria.
