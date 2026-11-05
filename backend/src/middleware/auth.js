const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

const ADMIN_ROLES = ['admin', 'superadmin'];
const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// requireAdmin: cualquier usuario con permisos de administracion.
// El superadmin hereda todo lo que puede hacer un admin.
function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

// requireSuperAdmin: solo el superadmin. Ademas de los permisos de admin,
// puede crear, ascender o eliminar cuentas admin.
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de super administrador.' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(authHeader.split(' ')[1]);
      req.user = decoded;
    } catch (_) {
      // Token inválido → seguimos como anónimo
    }
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin, optionalAuth, isAdminRole };
