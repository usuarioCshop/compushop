const jwt = require('jsonwebtoken');

// En produccion, falta JWT_SECRET = el proceso no arranca. En desarrollo se
// usa un fallback local para no bloquear onboarding, pero nunca publico.
const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en produccion: no se pueden firmar ni verificar tokens sin un secreto. Definilo en las variables de entorno de Vercel (o en backend/.env local) y reintenta.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'compushop_secret_DEV_ONLY';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
