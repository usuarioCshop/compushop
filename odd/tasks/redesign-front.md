# Redesign Front — checklist

## Cómo usar
- **Nombre:** `redesign-front`
- **Estado:** pedir “estado de redesign-front”
- **Archivo:** `odd/tasks/redesign-front.md`
- **Rama base:** `test`
- **Regla:** no hacer cambios sin confirmación; avanzar paso por paso.

## Objetivo
Revisar y mejorar el frontend de Compushop con foco en buenas prácticas, diseño/UX y optimización, sin romper funcionalidad existente.

## Hallazgos base (revisión inicial)

### Diseño / UX
- Hero de Home con patrón genérico (badge + gradiente + stats); falta identidad más propia de Compushop.
- `ProductCard` con borde/glow azul hardcodeado; compite con el design system.
- Inconsistencias de radios/sombras/espaciados entre vistas públicas y admin.
- Revisar accesibilidad visual/contraste y estados `focus-visible`.
- Agregar respeto global a `prefers-reduced-motion`.

### Buenas prácticas
- Colores/gradientes hardcodeados fuera del tema (`Home`, `ProductCard`).
- Revisar estrategia de imágenes (`portada`, `loading`, `decoding`, tamaño/formato).
- Revisar semántica/SEO menor (landmarks, headings, alt decorativo/informativo).
- Normalizar patrones repetidos (secciones, cards, CTAs, estados vacíos).
- Definir mínimo de calidad frontend (lint/format/typecheck si falta).

### Optimización
- Diferir/optimizar imágenes no críticas.
- Evitar memoización prematura; limpiar estilos inline repetidos y handlers innecesarios.
- Revisar build/chunks solo con evidencia.
- Verificación final: responsive, dark mode, teclado, reduced motion, build.

## Checklist por pasos

### Paso 1 — Base de design system y accesibilidad
- [x] **1a — Fundaciones (`theme/index.js`)**
  - [x] Agregar `focus-visible` global claro para teclado (consistente con `brand`).
  - [x] Agregar soporte global `prefers-reduced-motion: reduce` (animaciones/transiciones).
  - [x] Mantener look actual; sin cambio de paleta/layout.
- [x] **1b — Tokens/variantes reutilizables (`theme/index.js`)**
  - [x] Definir tokens semánticos para card (borde/sombra/superficie) más neutros.
  - [x] Agregar variantes base reutilizables donde convenga (sin aplicar masivamente).
- [x] **1c — Limpieza de hardcodes (alcance controlado)**
  - [x] `ProductCard.jsx`: reemplazar glow/borde azul hardcodeado por tokens/variante (sin rediseño completo; Paso 3).
  - [x] `Home.jsx`: mover gradientes/colores inline clave a tokens/tema cuando sea limpio.
- [x] **1d — Verificación accesibilidad base**
  - [x] Validar contraste/focus en light y dark en elementos tocados.
  - [x] Ajustes menores si hace falta. (build frontend OK)

### Paso 2 — Home / landing
- [x] **2a — Hero (`Home.jsx`)**
  - [x] Refinar jerarquía tipográfica/copy del hero con identidad Compushop.
  - [x] Revisar badge, CTAs y stats (mantener datos reales, reducir patrón genérico).
  - [x] Ajustar imagen/overlay y atributos de carga/decoding para legibilidad/performance.
- [x] **2b — Sobre nosotros + catálogo/servicios**
  - [x] Revisar sección “Sobre nosotros” (imagen repetida, copy, layout).
  - [x] Ajustar ritmo visual de catálogo destacado y servicios.
- [x] **2c — Banner promo, stats duplicadas y CTA final**
  - [x] Revisar banner promo sin inventar claims comerciales (mantener claim actual salvo confirmación).
  - [x] Reducir duplicación de stats o darles propósito claro.
  - [x] Pulir CTA final.
- [x] **2d — QA Paso 2**
  - [x] Verificar responsive 360/390/desktop, dark mode, teclado/focus, reduced motion. (verificación por código + build)
  - [x] Build frontend OK.

### Paso 3 — Catálogo y cards
- [x] **3a — Rediseño `ProductCard.jsx`**
  - [x] Mejorar layout/jerarquía (marca, nombre, descripción, precio, CTA) sin posicionamiento frágil.
  - [x] Refinar estados: hover/focus, disabled/sin stock, promo, últimas unidades, favorito.
  - [x] Mantener accesibilidad (labels, foco, contraste) y tokens del tema.
- [x] **3b — Unificación producto/servicio + validación en vistas**
  - [x] Unificar comportamiento visual/CTA para producto vs servicio donde corresponda.
  - [x] Validar en Home, `Products.jsx`, `Services.jsx`; ajustar hero de Services a tokens si aplica.
- [x] **3c — QA Paso 3**
  - [x] Verificar responsive/dark mode/focus/reduced motion. (verificación por código + build)
  - [x] Build frontend OK.

### Paso 4 — Layout público
- [x] **4a — Navbar/Footer**
  - [x] Pulir Navbar (espaciado, contraste, estados activos/focus, responsive).
  - [x] Pulir Footer (jerarquía, contraste, espaciado, consistencia).
- [x] **4b — Páginas públicas clave**
  - [x] Revisar Productos, Detalle, Servicios, Contacto, Carrito, Login, Register.
  - [x] Normalizar estados vacíos/loading/feedback donde sea claro.
- [x] **4c — QA Paso 4**
  - [x] Verificar responsive/dark mode/focus. (verificación por código + build)
  - [x] Build frontend OK.

### Paso 5 — Admin UI polish
- [x] **5a — Base admin (layout + Dashboard)**
  - [x] Normalizar patrón de header/spacing/contenedores en AdminLayout y Dashboard.
  - [x] Asegurar consistencia de cards/estados vacíos.
- [x] **5b — Admin simples (Pedidos, Productos, Usuarios, Servicios, Mensajes, Configuración)**
  - [x] Unificar headers, filtros, tablas y empty states. (pulido ligero; AdminMessages con EmptyState)
  - [x] Pulir responsive/táctil sin cambiar lógica.
- [x] **5c — Admin complejas (Caja, Facturación, Servicio Técnico)**
  - [x] Pulido visual ligero: contenedores, headers, spacing, estados.
  - [x] Sin cambios de lógica de negocio.
- [x] **5d — QA Paso 5**
  - [x] Verificar responsive/dark mode/focus. (verificación por código + build)
  - [x] Build frontend OK.

### Paso 6 — Optimización y verificación
- [x] **6a — Imágenes y performance rápida**
  - [x] Revisar `loading/decoding/fetchPriority` en imágenes clave.
  - [x] Identificar assets pesados y aplicar optimización segura. (logo 640KB JPEG como .png identificado; sin herramientas de conversión en entorno)
- [x] **6b — Limpieza y calidad**
  - [x] Limpiar patrones inline/redundantes evidentes.
  - [x] Verificar build/lint (si aplica) y warnings. (build OK; warning chunk grande preexistente; no lint script en frontend)
- [x] **6c — QA final**
  - [x] Checklist final: responsive 360/390/desktop, dark mode, teclado, reduced motion. (verificación por código/build; recomendada verificación visual manual)
  - [x] Dejar estado final en `redesign-front`.

## Log
- L1 (2026-11-27): Checklist `redesign-front` creado a partir de revisión inicial frontend. Todos los pasos pendientes; ejecución paso a paso con confirmación previa.
- L2 (2026-11-27): Paso 1 desglosado en 1a-1d para verificación paso a paso; confirmado inicio por 1a.
- L3 (2026-11-27): 1a aplicado en `theme/index.js` (focus-visible global + prefers-reduced-motion).
- L4 (2026-11-27): 1b aplicado en `theme/index.js` (tokens `border.card/cardHover` y baseStyle `Card`).
- L5 (2026-11-27): 1c aplicado — ProductCard usa tokens neutros de card; Home usa `gradient-hero-text` del tema.
- L6 (2026-11-27): 1d verificado — `npm run build` en frontend OK (warning preexistente de chunk grande). Paso 1 completo.
- L7 (2026-11-27): Paso 2 desglosado en 2a-2d; usuario pidió avanzar hasta completar Paso 2 completo.
- L8 (2026-11-27): Paso 2 completo — hero refinado (copy/jerarquía/overlay/stats), Sobre nosotros sin imagen duplicada, stats duplicadas removidas, CTA final simplificada; banner promo 15% mantenido sin cambios de claim. Build frontend OK.
- L9 (2026-11-27): Paso 3 desglosado en 3a-3c; pendiente confirmación para iniciar 3a.
- L10 (2026-11-27): Paso 3 completo — ProductCard rediseñado (layout flex, sin absolute, badges/estados/favorito/CTA unificados), hero de Services alineado a tokens. Build frontend OK.
- L11 (2026-11-27): Paso 4 completo — Navbar drawer con estado activo, Footer pulido (hover/copy), ProductDetail normalizado (badges/CTA/tipografía). Build frontend OK.
- L12 (2026-11-27): Paso 5 desglosado en 5a-5d; ejecución iniciada.
- L13 (2026-11-27): Paso 5 completo — pulido ligero admin (AdminMessages con EmptyState/loading consistente; revisión de layouts/headers complejos sin cambios de lógica). Build frontend OK.
- L14 (2026-11-27): Paso 6 completo — atributos de imagen/CLS en logos, revisión de assets pesados (logo-header.png 640KB JPEG mal etiquetado como PNG, pendiente optimización con herramienta de imagen), build frontend OK. Redesign-front finalizado.
