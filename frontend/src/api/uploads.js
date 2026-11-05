// Resuelve URLs relativas (/uploads/archivo.png) a la URL absoluta del backend.
// En desarrollo Vite sirve /uploads desde el mismo origen, asi que la ruta
// relativa alcanza. En produccion el frontend vive en otro dominio y /uploads
// caeria al catch-all del SPA: la imagen se ve rota aunque el archivo este.
const API_URL = import.meta.env.VITE_API_URL;
const isLocal = typeof window !== 'undefined'
  && /localhost|127\.0\.0\.1/.test(window.location.hostname);

const uploadsBase = isLocal
  ? ''
  : (API_URL || 'https://compushop-backend.vercel.app/api').replace(/\/api\/?$/, '');

export function resolveUploadUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${uploadsBase}${url.startsWith('/') ? '' : '/'}${url}`;
}
