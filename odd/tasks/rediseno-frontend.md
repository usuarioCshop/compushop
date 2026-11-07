# Feature: Rediseño frontend (Compushop)

Objetivo: mejorar la estética y el diseño del frontend de forma incremental,
con una secuencia sana (auditar → marca → design system → reemplazar → checklist).
Branch: `frontend-rediseno` (parte de `dev2`). Merge de vuelta a `dev2` cuando el rediseño esté aprobado. Delivery: `ask-on-risk`. Verificación: `npm run dev` en frontend (5173) con backend 4000.

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

- [x] T1 | S1 | Auditoría del frontend actual: páginas, theme, componentes, colores hardcodeados, responsive y modo oscuro | inline | completado (2026-11-06)
- [x] T2 | S2 | Mini-brief de marca con el usuario: tono, colores, tipografía, radio, densidad | inline | completado (2026-11-06)
- [x] T3 | S3 | Consolidar design system en theme/index.js (tokens, variantes, componentes comunes) sin romper lo existente | inline | completado (2026-11-06)
- [x] T4 | S4 | Reemplazar/ajustar Home | inline | completado (2026-11-06)
- [x] T5 | S4 | Reemplazar/ajustar Catálogo (Products + filtros) | inline | completado (2026-11-06)
- [x] T6 | S4 | Reemplazar/ajustar Detalle de producto | inline | completado (2026-11-06)
- [x] T7 | S4 | Reemplazar/ajustar Carrito y flujo de pedido | inline | completado (2026-11-07)
- [x] T8 | S4 | Reemplazar/ajustar Admin (Usuarios, Productos, Dashboard) | inline | completado (2026-11-07)
- [x] T9 | S5 | Checklist de calidad completo por cada cambio entregado (contraste, vacío, error, loading, 360px, oscuro); backup en commits separados | inline | completado con hallazgos (2026-11-07)


## Auditoría del frontend actual (2026-11-06, T1)

### Fortalezas
- `theme/index.js` es serio: tokens semánticos completos (`bg.canvas/surface/subtle/elevated/inverted`, `fg.default/muted`, `border.subtle/strong`), ramas `brand` y `accent` con `colorModeValue`, componentes comunes estilizados (Button/Input/Select/Textarea/Table/Modal/Drawer) y modo oscuro completo.
- `index.html`: `lang="es"`, meta description, viewport, theme-color light/dark.
- Responsive por props de Chakra (`base/md/lg`); no hay `useBreakpointValue` pero tampoco necesidad.
- Sin emojis en la UI (bien). `aria-label` en 12 lugares (usa iconos solo).

### Problemas observados
1. **Colores hardcodeados fuera del design system.** Home (12 hex + 19 rgba: banner gradients `#2563eb→#1d4ed8`, hero `rgba(2,6,23,0.4/0.9)`, sección `#f8fafc` y `#a78bfa/#22d3ee`), ServiceDetail (8), Services (4), ProductCard (~6 en card sombra/badge), Navbar (2). El hero y los banners deberían salir de tokens, no de valores sueltos.
2. **Gradients de promoción e iconos inline** en Home/ServiceDetail/Services en vez de variantes del tema.
3. **Escala de espaciado inconsistente**: `spacing` sueltos entre 3 y 12 sin patrón por sección; radii mezcla (`lg`, `xl`, `2xl`) sin criterio por tipo de elemento.
4. **Sombras y bordes inline** en ProductCard/Navbar (rgba específicos) en lugar de tokens de elevación.
5. **Imagen sin `alt`** en Cart.jsx (una Image).
6. **Estilos inline menores**: `style={{ display: 'none' }}` en input file de AdminProducts/AdminServices — mejor con `sx`/`display='none'` de Chakra.
7. **Skeletons/loadings y estados vacíos** no son uniformes entre páginas (algunos `Spinner`, `Center`, `Empty` sueltos; sin componente reutilizable `EmptyState`).
8. **Admin**: componentes de tabla/página con estilos repetidos; spacing irregular (`AdminUsers` y `Dashboard` con patrones distintos).
9. **Pérdida de cohesión entre hero y resto del catálogo** en Home: hero con estética distinta al resto (gradientes pesados), debería respirar el mismo lenguaje visual.
10. **`theme-color` del index.html no coincide exactamente con los tokens** (light `#F8FAFC` vs `#f1f5f9`; dark `#0B0F19` vs `#070b14`).

### Lo que funciona y no tocar
- El esqueleto Chakra + `bg.canvas` + `bg.surface`, el patrón de navegación, el formulario de login, la resolución `/uploads` (ya arreglada).

## Plan de saneo (input para T2–T9)
1. Mover todos los hex/rgba hardcodeados a `theme/index.js` como tokens semánticos (banner, hero, card-shadow, empty-state...).
2. Unificar escala de espaciado por sección y radii por jerarquía de elemento.
3. Componente `EmptyState` reutilizable con icono + mensaje + CTA.
4. Alinear `theme-color` con tokens reales.
5. De ahí, T2 (marca) y T3 (consolidar tema) y después página por página.

## Brief de marca (2026-11-06, T2)

### Personalidad: Premium profesional
- Confiable, sobrio, tecnología seria. Nada de ruido gamer.
- Mucho aire (whitespace), jerarquía clara, pocos acentos de color.
- Oscuro (dark mode) como ciudadano de primera, no afterthought.

### Paleta
- **brand — azul** (ya está en el tema, se conserva): `brand.500 #2563eb`, `brand.600 #1d4ed8`, `brand.700 #1e40af`, `brand.900 #1e3a8a`. Oscuro con `#172554` al fondo. Uso: primarios, links, focus.
- **accent — violeta** (nueva rama en el tema): `accent.500 #7c3aed`, `accent.600 #6d28d9`, `accent.700 #5b21b6`, `accent.50 #f5f3ff`. Uso: promociones, badges de oferta, highlights, gradiente de hero (brand.600 → accent.600).
- **neutros**: conservar `bg.canvas/surface/subtle/elevated/inverted` y `fg.default/muted` (slate). Sin cambios.
- **gradientes**: máximo efecto decorativo coherente: hero y banners = brand.600 → accent.600; cero gradientes sueltos inline.

### Tipografía
- **Cuerpo**: Inter (ya cargada y usada).
- **Titulares**: **Sora** (600/700). Portará toda la jerarquía h1–h4/card titles.
- Carga: Google Fonts `<link>` con `display=swap` para Sora (habitualmente desde fonts.googleapis.com); si es offline, fallback a system-ui.
- Escala de headings: h1 text-5xl/tight, h2 text-4xl/tight, h3 text-2xl/tight, h4 text-xl/tight; body text-base.

### Forma y detalle
- Radii: `md` (0.75rem) para inputs/selects; `lg` (1.25rem) para cards; `2xl`/`3xl` solo hero/colores de sección; `full` para botones e iconos. Nada de 4/8/16 arbitrarios.
- Sombra: suave (`0 4px 16px rgba(15,23,42,0.08)`), una sola escalera (sm/md/lg); sin glows neón.
- Bordes: 1px `border.subtle`; más fuertes solo en hover/focus con `border.strong`.
- Espaciado: escala de 4/8/12/16/24/32/48/64/96 pixeles (Chakra spacing mantiene); sección visible = 64–128px verticalmente.

### Estados
- Vacío: componente EmptyState con icono grande, h4 + texto muted + CTA opcional.
- Cargando: Spinner en Center (ya está la pauta) pero uniforme.
- Error: mensaje breve + botón Reintentar.
- Éxito: Toast (Chakra) con title corto.



## Checklist T9 (2026-11-07, evidencia estructural + QA visual pendiente del usuario)

### Entregado y verificado (T4-T8)
- **Estados vacío:** Cart, Catálogo y Detalle usan `EmptyState`. AdminUsers/Messages/Dashboard usan mensajes inline en tablas (aceptable).
- **Loading:** spinners/skeletons presentes en páginas entregadas; botones críticos con `isLoading`.
- **Error:** toasts en operaciones (cart confirm, admin CRUD/import). Faltan estados de error con “Reintentar” dedicados en algunas vistas (gap menor, no introducido por el rediseño).
- **Imagen alt:** corregido en Cart (auditoría #5). Inputs file ocultos con `hidden` (auditoría #6, Products/Services).
- **Modo oscuro (tokens):** páginas entregadas usan tokens semánticos (`bg.*`, `fg.*`, `border.*`, `shadow-card`, `gradient-brand`, `_dark` donde aplica). Apariencia real en oscuro: requiere QA visual.
- **Responsive:** uso de props `base/md/lg` y layout en columna en mobile (ej. Cart). **360px real: requiere QA visual.**
- **Contraste AA:** no verificable por render automático aquí. **Requiere QA visual/herramienta de contraste.**

### Residuales fuera del alcance de T4-T8 (preexistentes, no regresión)
- `Navbar.jsx`, `ProductCard.jsx`, `Services.jsx`, `ServiceDetail.jsx`: **resueltos en L14** (alineados al design system; se conservan solo overlays fotográficos).
- Overlays rgba del hero de Home son intencionales (composición fotográfica, documentado en L8).

### Conclusión
- Checklist estructural de lo entregado: **OK con gaps menores** (error+retry dedicado; residual en páginas no tocadas). Contraste AA, 360px y modo oscuro real quedan **pendientes de validación visual del usuario** en `localhost:5173`.

## Log

- L1 (2026-11-06): Pedido original: "como crees que deberia seguir para entrar a trabajar con la estetica y diseño del frontend"
- L2 (2026-11-06): Se propuso secuencia de 5 etapas (auditar → marca → design system → reemplazar → checklist); el usuario está completamente de acuerdo.
- L3 (2026-11-06): Solicitud de seguimiento: lista de tareas con esos puntos para ir avanzando de a uno, consultable en cualquier momento. Este archivo es la fuente de verdad del estado; mirror en Engram (`odd/frontend-rediseno/tasks`).
- L4 (2026-11-06): Se crea la rama `frontend-rediseno` partiendo de `dev2` para trabajar en aislamiento (Vercel puede generar preview deploys de la rama). Decisión del usuario: se mejora sobre el diseño ACTUAL, no se rediseña de cero. La auditoría (T1) debe partir de lo existente.
- L5 (2026-11-06): T1 completada. Auditoría escrita: theme sólido pero hardcodeados en Home/ServiceDetail/Services/ProductCard/Navbar; falta componente EmptyState; espaciado/radii sin escala; theme-color del index.html no alinea con tokens. Commit a30e45f.
- L6 (2026-11-06): T2 completada. Brief de marca: premium profesional; brand azul + accent violeta, Inter cuerpo + Sora titulares, gradiente único brand→accent, radii/espaciado definidos. Commit 47f8572.
- L7 (2026-11-06): T3 completada. Design system consolidado: accent violeta, Sora en theme e index.html, shadows/gradientes semánticos (gradient-brand), theme-color alineado, EmptyState. Verificado esbuild/vite. Commit ce44619.
- L8 (2026-11-06): T4 completada y aprobada visualmente. Home con gradient-brand, H1 Sora, botón brand.600, sombras/tokens; overlays fotográficos del hero conservados a propósito. Commit 2a4aac3.
- L9 (2026-11-06): T5 completada. Catálogo con jerarquía (total), búsqueda con ícono, limpiar filtros, EmptyState. Commit 356a792.
- L10 (2026-11-06): T6 completada. Detalle con promo accent, badges subtle, precio brand.600, EmptyState not-found con useNavigate, shadow-card. Commit ae69468.
- L11 (2026-11-07): T7 completada y aprobada visualmente. Carrito: EmptyState vacío, items/resumen con shadow-card, alt en imagen, jerarquía, CTA accent redondeado. Confirmar pedido crea orden real (backend prod). Commit b527d7f.
- L12 (2026-11-07): T8 completada y aprobada visualmente. Admin (Dashboard, Usuarios, Productos) + Layout/Services: superficies consistentes, roles/badges accent, inputs file hidden (fix auditoría). Lógica sin cambios. Commit c57f5ab.
- L13 (2026-11-07): T9 ejecutada (checklist estructural). Entregado OK con gaps menores; requiere QA visual del usuario: contraste AA, 360px real, modo oscuro real. Residuales fuera de alcance anotados (luego resueltos en L14). Commit b00065a.
- L14 (2026-11-07): Residuales resueltos y aprobados visualmente. Navbar, ProductCard, Services, ServiceDetail alineados al design system (sin glows cyan; promos accent; héroes servicios brand+violeta/Sora; overlays fotográficos conservados). Commit 719fc94.
- L15 (2026-11-07): Ajuste ProductCard aprobado. Imagen ancho completo, object-fit cover, 50% altura en desktop (maxH mobile). Sombra/borde azul reforzado con borde marcado en hover. Commit e267a6c.

## Para consultar el estado (preguntar al agente)

> "En qué estado estamos con el rediseño del frontend?" → responde mirando este archivo (Tasks) y el Log.
