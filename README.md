# Compushop

Sitio de e-commerce para una casa de computación: catálogo de productos y servicios, carrito, pedidos, contacto y un panel de administración.

- **Frontend:** React 18 + Vite + Chakra UI (tema claro/oscuro)
- **Backend:** Node.js + Express (API REST, autenticación JWT)
- **Persistencia:** SQLite vía `sql.js` (WASM, sin binario nativo)

## Estructura

```
backend/     API REST (Express)
  api/       entry point serverless para Vercel
  src/
    controllers/   auth, products, services, orders, users, categories, contact, settings, dashboard
    db/            database.js (capa única de persistencia), seed.js, compushop.db (generada)
    middleware/    verificación de JWT y roles
    routes/        router principal de la API
    utils/         jwt, email (nodemailer)
  test/      pruebas con node --test

frontend/    SPA (React + Vite)
  src/
    api/         cliente axios
    components/  Navbar, ProductCard
    context/     AuthContext, CartContext
    pages/       páginas públicas y admin/
    theme/       tema de Chakra UI (paletas claro/oscuro)
```

## Requisitos

- Node.js 18 o superior
- npm

## Puesta en marcha

Cada paquete tiene sus propias dependencias; no hay workspace en la raíz.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # en Windows: copy .env.example .env
npm run seed             # carga datos de ejemplo
npm run dev              # http://localhost:4000
```

Credenciales creadas por el seed:

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | `admin@compushop.com` | `admin123` |
| Cliente | `juan@email.com` | `cliente123` |

> **Importante:** `sql.js` mantiene la base en memoria y reescribe el archivo en cada escritura. Si ejecutás `npm run seed` con el servidor levantado, el servidor pisa el `.db` con su copia en memoria en la próxima escritura. **Sembrá con el servidor detenido**, o reinicialo después de sembrar.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

Vite hace de proxy de `/api` hacia el backend, así que en desarrollo no hace falta configurar nada más.

## Variables de entorno

`backend/.env` (ver `backend/.env.example`):

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 4000) |
| `JWT_SECRET` | Secreto para firmar los tokens |
| `JWT_EXPIRES_IN` | Vigencia del token (por defecto `7d`) |
| `DB_PATH` | Ruta del archivo SQLite (por defecto `./src/db/compushop.db`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Credenciales de correo saliente |
| `SMTP_FROM`, `CONTACT_TO` | Remitente y destinatario de las notificaciones |

`frontend/.env` (ver `frontend/.env.example`): `VITE_API_URL` para apuntar a otro backend.

> `.env` **nunca** se commitea. Usá `.env.example` como plantilla.

## Scripts

| Ubicación | Comando | Qué hace |
| --- | --- | --- |
| `backend/` | `npm run dev` | Servidor con recarga automática |
| `backend/` | `npm start` | Servidor sin recarga |
| `backend/` | `npm run seed` | Carga (o recarga) los datos de ejemplo |
| `backend/` | `npm test` | Pruebas de persistencia, smoke HTTP y transacciones |
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

Hay configuración de Vercel tanto en `backend/` (función serverless) como en `frontend/` (reescritura de SPA). El frontend apunta al backend mediante `VITE_API_URL`.

> **Limitación conocida:** el filesystem de las funciones serverless es efímero y de solo lectura fuera de `/tmp`, así que la persistencia en el archivo `.db` no sobrevive entre invocaciones. Para producción hace falta una base de datos real (Postgres, por ejemplo) o un servicio con volumen. El esquema actual es portable.
