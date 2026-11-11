const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const { authenticate, requireAdmin, requireSuperAdmin, requireTecnico, optionalAuth } = require('../middleware/auth');
const { sendContactEmail } = require('../utils/email');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validations/auth');
const { contactSchema } = require('../validations/contact');
const {
  technicalRepairCreateSchema,
  technicalRepairUpdateSchema,
  technicalRepairIdSchema,
  technicalRepairQuerySchema,
} = require('../validations/technicalRepairs');

const authCtrl = require('../controllers/authController');
const productsCtrl = require('../controllers/productsController');
const categoriesCtrl = require('../controllers/categoriesController');
const servicesCtrl = require('../controllers/servicesController');
const ordersCtrl = require('../controllers/ordersController');
const usersCtrl = require('../controllers/usersController');
const contactCtrl = require('../controllers/contactController');
const settingsCtrl = require('../controllers/settingsController');
const dashboardCtrl = require('../controllers/dashboardController');
const wishlistCtrl = require('../controllers/wishlistController');
const technicalRepairsCtrl = require('../controllers/technicalRepairsController');
const repairCatalogsCtrl = require('../controllers/repairCatalogsController');
const repairClientsCtrl = require('../controllers/repairClientsController');

const IS_VERCEL = !!process.env.VERCEL;
const { uploadsDir: uploadDir } = require('../utils/uploads');

function ensureUploadsDir() {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    // Nunca dejar que esto tumbe el proceso. El endpoint de upload devolvera
    // error por archivo, pero el resto de la API sigue funcionando.
    console.warn(`No se pudo crear ${uploadDir}: ${err.message}`);
  }
}
ensureUploadsDir();

const UPLOADS_ON_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const imageUpload = multer({
  storage: multer.memoryStorage(), // el archivo va a Vercel Blob o a disco; nunca queda a medias en el build
  limits: { fileSize: 4 * 1024 * 1024 }, // el body de una funcion de Vercel tope 4.5MB; un exceso aca cae en el error handler y no en un 413 silencioso de Vercel
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'));
    cb(null, true);
  },
});

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif) o PDF'));
    cb(null, true);
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname) || [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ].includes(file.mimetype);
    if (!ok) return cb(new Error('Formato no permitido. Usá .xlsx, .xls o .csv'));
    cb(null, true);
  },
});

// ========== AUTH ==========
router.post('/auth/register', validate(registerSchema), authCtrl.register);
router.post('/auth/login', validate(loginSchema), authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);
router.post('/auth/forgot-password', validate(forgotPasswordSchema), authCtrl.forgotPassword);
router.post('/auth/reset-password', validate(resetPasswordSchema), authCtrl.resetPassword);

// ========== CATEGORIES ==========
router.get('/categories', categoriesCtrl.getAll);
router.post('/categories', authenticate, requireAdmin, categoriesCtrl.create);
router.put('/categories/:id', authenticate, requireAdmin, categoriesCtrl.update);
router.delete('/categories/:id', authenticate, requireAdmin, categoriesCtrl.remove);

// ========== PRODUCTS ==========
router.get('/products', productsCtrl.getAll);
router.post('/products/update-prices', authenticate, requireAdmin, productsCtrl.updatePricesByCost);
router.post('/products/import', authenticate, requireAdmin, upload.single('file'), productsCtrl.importProducts);
router.post('/products', authenticate, requireAdmin, productsCtrl.create);
router.get('/products/:id', productsCtrl.getOne);
router.put('/products/:id', authenticate, requireAdmin, productsCtrl.update);
router.delete('/products/:id', authenticate, requireAdmin, productsCtrl.remove);

// ========== SERVICES ==========
router.get('/services', servicesCtrl.getAll);
router.post('/services', authenticate, requireAdmin, servicesCtrl.create);
router.get('/services/:id', servicesCtrl.getOne);
router.put('/services/:id', authenticate, requireAdmin, servicesCtrl.update);
router.delete('/services/:id', authenticate, requireAdmin, servicesCtrl.remove);

// ========== ORDERS ==========
router.post('/orders', optionalAuth, ordersCtrl.create);
router.get('/orders', authenticate, ordersCtrl.getAll);
router.get('/orders/:id', authenticate, ordersCtrl.getOne);
router.put('/orders/:id/status', authenticate, requireAdmin, ordersCtrl.updateStatus);

// ========== USERS ==========
router.get('/users', authenticate, requireAdmin, usersCtrl.getAll);
router.post('/users', authenticate, requireSuperAdmin, usersCtrl.createUser);
router.put('/users/:id', authenticate, requireAdmin, usersCtrl.update);
router.delete('/users/:id', authenticate, requireAdmin, usersCtrl.remove);

// ========== TECNICAL REPAIRS (servicio tecnico, solo tecnico/admin) ==========
router.get('/technical-repairs', authenticate, requireTecnico, validate(technicalRepairQuerySchema), technicalRepairsCtrl.getAll);
router.post('/technical-repairs', authenticate, requireTecnico, validate(technicalRepairCreateSchema), technicalRepairsCtrl.create);
router.get('/technical-repairs/next-ticket', authenticate, requireTecnico, technicalRepairsCtrl.getNextTicket);
router.get('/technical-repairs/technicians', authenticate, requireTecnico, technicalRepairsCtrl.getTechnicians);
router.get('/technical-repairs/:id', authenticate, requireTecnico, validate(technicalRepairIdSchema), technicalRepairsCtrl.getOne);
router.put(
  '/technical-repairs/:id',
  authenticate,
  requireTecnico,
  validate(technicalRepairIdSchema),
  validate(technicalRepairUpdateSchema),
  technicalRepairsCtrl.update
);
router.delete('/technical-repairs/:id', authenticate, requireTecnico, validate(technicalRepairIdSchema), technicalRepairsCtrl.remove);

// Catalogos y clientes de servicio tecnico.
router.get('/repair-catalogs/:type', authenticate, requireTecnico, repairCatalogsCtrl.getAll);
router.post('/repair-catalogs/:type', authenticate, requireTecnico, repairCatalogsCtrl.create);
router.get('/repair-clients', authenticate, requireTecnico, repairClientsCtrl.getAll);
router.post('/repair-clients', authenticate, requireTecnico, repairClientsCtrl.create);

// Upload de imagen del equipo (servicio tecnico).
router.post('/upload/repair-image', authenticate, requireTecnico, imageUpload.single('image'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ninguna imagen' });
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  try {
    if (UPLOADS_ON_BLOB) {
      const { put } = require('@vercel/blob');
      const blob = await put(`repair-images/${name}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        addRandomSuffix: true,
      });
      return res.json({ url: blob.url });
    }
    ensureUploadsDir();
    await fs.promises.writeFile(path.join(uploadDir, name), req.file.buffer);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    next(err);
  }
});

// ========== CONTACT ==========
router.post('/contact', validate(contactSchema), contactCtrl.sendMessage);
router.get('/contact', authenticate, requireAdmin, contactCtrl.getMessages);
router.put('/contact/:id/read', authenticate, requireAdmin, contactCtrl.markAsRead);

// ========== SETTINGS ==========
router.get('/settings', authenticate, requireAdmin, settingsCtrl.getAll);
router.put('/settings', authenticate, requireAdmin, settingsCtrl.update);

// ========== DASHBOARD ==========
router.get('/dashboard/stats', authenticate, requireAdmin, dashboardCtrl.getStats);

// ========== WISHLIST ==========
router.get('/wishlist', authenticate, wishlistCtrl.getAll);
router.post('/wishlist', authenticate, wishlistCtrl.add);
router.delete('/wishlist/:product_id', authenticate, wishlistCtrl.remove);

// ========== UPLOAD ==========
router.post('/upload', authenticate, requireAdmin, imageUpload.single('image'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ninguna imagen' });
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  try {
    if (UPLOADS_ON_BLOB) {
      const { put } = require('@vercel/blob');
      const blob = await put(`images/${name}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        addRandomSuffix: true,
      });
      return res.json({ url: blob.url });
    }
    // Fallback local: disco (en Vercel /tmp, efimero pero no tumba la app).
    ensureUploadsDir();
    await fs.promises.writeFile(path.join(uploadDir, name), req.file.buffer);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    next(err);
  }
});

// Upload de comprobante de pago (checkout, público). Imagen o PDF.
router.post('/upload/receipt', optionalAuth, receiptUpload.single('receipt'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ningún comprobante' });
  }
  const ext = path.extname(req.file.originalname).toLowerCase() || (req.file.mimetype === 'application/pdf' ? '.pdf' : '');
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  try {
    if (UPLOADS_ON_BLOB) {
      const { put } = require('@vercel/blob');
      const blob = await put(`receipts/${name}`, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
        addRandomSuffix: true,
      });
      return res.json({ url: blob.url });
    }
    ensureUploadsDir();
    await fs.promises.writeFile(path.join(uploadDir, name), req.file.buffer);
    res.json({ url: `/uploads/${name}` });
  } catch (err) {
    next(err);
  }
});

// ========== HEALTH ==========
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    console.error(error);
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

module.exports = router;