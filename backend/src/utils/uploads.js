// Utilidad compartida para la carpeta de uploads.
// En serverless Vercel el filesystem del build es de solo lectura, por lo que
// los archivos se escriben en /tmp (efimero) para no tumbar la funcion.
const path = require('path');

const IS_VERCEL = !!process.env.VERCEL;

const uploadsDir = process.env.UPLOADS_DIR || (IS_VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', '..', 'uploads'));

module.exports = { IS_VERCEL, uploadsDir };
