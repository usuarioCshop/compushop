const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { sendContactEmail } = require('../utils/email');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validations/auth');
const { contactSchema } = require('../validations/contact');

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

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp|gif)/.test(file.mimetype);
    if (!ok) return cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif)'));
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
router.put('/users/:id', authenticate, requireAdmin, usersCtrl.update);
router.delete('/users/:id', authenticate, requireAdmin, usersCtrl.remove);

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
router.post('/upload', authenticate, requireAdmin, imageUpload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se envió ninguna imagen' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
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