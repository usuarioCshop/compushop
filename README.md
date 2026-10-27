# Compushop

Sitio de e-commerce para una casa de computación: catálogo de productos y servicios, carrito, pedidos, contacto y un panel de administración.

- **Frontend:** React 18 + Vite + Chakra UI (tema claro/oscuro)
- **Backend:** Node.js + Express (API REST, autenticación JWT)
- **Persistencia:** PostgreSQL (Neon) vía `pg`

## Estructura

```
backend/     API REST (Express)
  api/       entry point serverless para Vercel
  src/
    controllers/   auth, products, services, orders, users, categories, contact, settings, dashboard
    db/            database.js (capa única de persistencia, async), migrate.js, seed.js, migrations/001_init.sql
    middleware/    verificación de JWT y roles
    routes/        router principal de la API
    utils/         jwt, email (nodemailer)
  test/      pruebas con node --test (persistencia, smoke HTTP, transacciones)

frontend/    SPA (React + Vite)
  src/
    api/         cliente axios
    components/  Navbar, ProductCard
    context/     AuthContext, CartContext
    pages/       páginas públicas y admin/
    theme/       tema de Chakra UI (paletas claro/oscuro)
```

## Requisitos

- Node.js 22 o superior
- npm

## Puesta en marcha

Cada paquete tiene sus propias dependencias; no hay workspace en la raíz.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # en Windows: copy .env.example .env
```

Completá `DATABASE_URL` (conexión pooled de Neon) y, opcionalmente, `DATABASE_URL_UNPOOLED` en `backend/.env`. Ver [Variables de entorno](#variables-de-entorno).

Aplicá el esquema y cargá los datos de ejemplo:

```bash
npm run migrate      # aplica las migraciones pendientes
npm run migrate:status # comprueba el estado de las migraciones
npm run seed         # carga datos de ejemplo (con el servidor detenido)
npm run dev          # http://localhost:4000
```

Credenciales creadas por el seed:

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | `admin@compushop.com` | `admin123` |
| Cliente | `juan@email.com` | `cliente123` |

> **Importante:** Las migraciones se aplican explícitamente con `npm run migrate`. La app no crea el esquema al arrancar. Para sembrar, hacelo con el servidor **detenido**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Vite hace de proxy de `/api` hacia el backend, así que en desarrollo no hace falta configurar nada más.

## Variables de entorno

### `backend/.env` (ver `backend/.env.example`)

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 4000) |
| `JWT_SECRET` | Secreto para firmar los tokens |
| `JWT_EXPIRES_IN` | Vigencia del token (por defecto `7d`) |
| `FRONTEND_URL` | Origen adicional permitido por CORS (opcional) |
| `DATABASE_URL` | **Obligatoria.** Cadena de conexión pooled de Neon/Postgres. Usada por la app en runtime. |
| `DATABASE_URL_UNPOOLED` | Cadena directa (sin pooler). Usada por `migrate` y `seed`. Si no se define, caen a `DATABASE_URL`. |
| `TEST_DATABASE_URL` | Cadena de conexión para la suite de tests. Debe apuntar a una base **distinta** a la de la app (los tests migran, truncan y re-siembran). Sin ella, los tests se saltean. |
| `PGPOOL_MAX` | Máximo de conexiones en el pool (por defecto `1`). |
| `PGSSL` | Poner `disable` para PostgreSQL local sin TLS. |
| `PG_SSL_NO_VERIFY` | Poner `true` si el bundle de CA de Node no reconoce el certificado (opcional). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Credenciales de correo saliente (opcionales). |
| `SMTP_FROM`, `CONTACT_TO` | Remitente y destinatario de las notificaciones (opcionales). |
| `SEED_FORCE` | Poner `true` para permitir `npm run seed` con `NODE_ENV=production` (protección). |

### `frontend/.env` (ver `frontend/.env.example`)

`VITE_API_URL` para apuntar a otro backend. Si no se define, en localhost usa `http://localhost:4000/api` y en producción usa `https://compushop-backend.vercel.app/api`.

> `.env` **nunca** se commitea. Usá `.env.example` como plantilla.

## Scripts

| Ubicación | Comando | Qué hace |
| --- | --- | --- |
| `backend/` | `npm run dev` | Servidor con recarga automática (`node --watch`) |
| `backend/` | `npm start` | Servidor sin recarga |
| `backend/` | `npm run migrate` | Aplica migraciones pendientes (`schema_migrations`) |
| `backend/` | `npm run migrate:status` | Muestra el estado de las migraciones |
| `backend/` | `npm run seed` | Carga (o recarga) los datos de ejemplo |
| `backend/` | `npm test` | Pruebas de persistencia, smoke HTTP y transacciones (requiere `TEST_DATABASE_URL`) |
| `frontend/` | `npm run dev` | Servidor de desarrollo de Vite |
| `frontend/` | `npm run build` | Build de producción en `dist/` |
| `frontend/` | `npm run preview` | Sirve el build localmente |

## API

Base: `/api`. Las rutas marcadas con 🔒 requieren `Authorization: Bearer <token>`; 👑 requieren además rol `admin`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/register` | Registro de cliente |
| POST | `/auth/login` | Inicio de sesión |
| GET | `/auth/me` 🔒 | Datos del usuario autenticado |
| POST | `/auth/forgot-password` | Solicita el correo de recuperación |
| POST | `/auth/reset-password` | Restablece la contraseña con el token |
| GET | `/categories` | Lista de categorías |
| POST/PUT/DELETE | `/categories[/:id]` 🔒👑 | Alta, edición y baja de categorías |
| GET | `/products`, `/products/:id` | Catálogo y detalle |
| POST/PUT/DELETE | `/products[/:id]` 🔒👑 | Alta, edición y baja de productos |
| GET | `/services`, `/services/:id` | Servicios y detalle |
| POST/PUT/DELETE | `/services[/:id]` 🔒👑 | Alta, edición y baja de servicios |
| POST | `/orders` | Crea un pedido (acepta usuario invitado) |
| GET | `/orders`, `/orders/:id` 🔒 | Pedidos del usuario (todos, si es admin) |
| PUT | `/orders/:id/status` 🔒👑 | Cambia el estado de un pedido |
| GET/PUT/DELETE | `/users[/:id]` 🔒👑 | Gestión de usuarios |
| POST | `/contact` | Envía un mensaje desde el formulario |
| GET | `/contact` 🔒👑 | Bandeja de mensajes recibidos |
| PUT | `/contact/:id/read` 🔒👑 | Marca un mensaje como leído |
| GET/PUT | `/settings` 🔒👑 | Configuración de la tienda |
| GET | `/dashboard/stats` 🔒👑 | Métricas del panel |

## Convenciones

- Idioma de la interfaz, los comentarios y los mensajes: **español**.
- Backend en CommonJS; frontend en ESM.
- Commits en [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), sin atribución de IA.

## Deploy

Hay configuración de Vercel tanto en `backend/` (función serverless, entrada en `api/index.js`) como en `frontend/` (reescritura de SPA). El frontend apunta al backend mediante `VITE_API_URL`. La persistencia vive en **Postgres (Neon)**, por lo que el filesystem efímero de las funciones serverless no es un problema. Para que el backend arranque en Vercel es obligatorio tener `DATABASE_URL` configurada en las variables de entorno del proyecto.
