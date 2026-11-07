# Fix cards (rama `fix-card`, desde `frontend-rediseno`)

Alcance: **solo** `frontend/src/components/ProductCard.jsx` (cards de productos y servicios). Verificación visual en `localhost:5173` (catálogo, home, servicios).

## Checklist

- [x] 1. Precio y botón "Comprar/Contratar" a 2% del borde inferior (fila absoluta `bottom: 2%`). **Aceptado.**
- [x] 2. Si el producto no trae marca, mostrar **"Sin Marca"** con el mismo formato que una marca real. **Aceptado.**
- [x] 3. Si el **nombre** (`name`) supera el espacio de la línea, recortarlo a 1 línea y agregar `...`. **Aceptado.**
- [x] 4. Si el detalle es muy largo, ajustarlo a 2 líneas y agregar `...` al final. **Aceptado.**
- [x] 5. Badge "Últimas Unidades": incrementar opacidad del texto y del fondo; “PROMOCIÓN” reforzada en modo oscuro. **Aceptado.**
- [x] 6. Corazón de favorito en **modo oscuro**, cuando está desactivado: icono en azul. **Aceptado.**
- [x] 7. Alturas de card inconsistentes (ej. 370px vs 613px): imagen con `aspectRatio={4/3}` (depende del ancho, no del alto) para evitar inflación. **Aceptado.**

## Acuerdo de trabajo

- Tras cada cambio, reiniciar `localhost` (frontend, y backend si aplica) porque HMR no refresca bien.

## Log

- L1 (2026-11-07): Pedido del usuario, lista de 6 puntos. Rama `fix-card` creada desde `frontend-rediseno` (8c68205).
- L2 (2026-11-07): Se aplicaron los 6 juntos y al usuario no le gustaron; se revirtió `ProductCard.jsx`. Se retoma punto por punto con aprobación en cada uno.
- L3 (2026-11-07): Punto 1 aceptado (fila absoluta `bottom: 2%`). Acuerdo: reiniciar localhost tras cada cambio.
- L4 (2026-11-07): Puntos 2-6 aceptados uno por uno (punto 3 corregido: truncar `name`, no marca; punto 6 corregido: ícono azul en oscuro, no borde). Punto 7 agregado por el usuario (alturas 370/613px): causa = imagen `flex 50%` del alto de la card; fix = `aspectRatio 4:3` dependiente del ancho. Puntos 1-7 aceptados; listo para commitear.
