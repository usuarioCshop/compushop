const express = require('express');
const router = express.Router();
const multer = require('multer');

const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { sendContactEmail } = require('../utils/email');

const authCtrl = require('../controllers/authController');
const productsCtrl = require('../controllers/productsController');
const categoriesCtrl = require('../controllers/categoriesController');
const servicesCtrl = require('../controllers/servicesController');
const ordersCtrl = require('../controllers/ordersController');
const usersCtrl = require('../controllers/usersController');
const contactCtrl = require('../controllers/contactController');
const settingsCtrl = require('../controllers/settingsController');
const dashboardCtrl = require('../controllers/dashboardController');

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
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password', authCtrl.resetPassword);

// ========== CATEGORIES ==========
router.get('/categories', categoriesCtrl.getAll);
router.post('/categories', authenticate, requireAdmin, categoriesCtrl.create);
router.put('/categories/:id', authenticate, requireAdmin, categoriesCtrl.update);
router.delete('/categories/:id', authenticate, requireAdmin, categoriesCtrl.remove);

// ========== PRODUCTS ==========
router.get('/products', productsCtrl.getAll);
router.get('/products/:id', productsCtrl.getOne);
router.post('/products/import', authenticate, requireAdmin, upload.single('file'), productsCtrl.importProducts);
router.post('/products', authenticate, requireAdmin, productsCtrl.create);
router.put('/products/:id', authenticate, requireAdmin, productsCtrl.update);
router.delete('/products/:id', authenticate, requireAdmin, productsCtrl.remove);

// ========== SERVICES ==========
router.get('/services', servicesCtrl.getAll);
router.get('/services/:id', servicesCtrl.getOne);
router.post('/services', authenticate, requireAdmin, servicesCtrl.create);
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
router.post('/contact', contactCtrl.sendMessage);
router.get('/contact', authenticate, requireAdmin, contactCtrl.getMessages);
router.put('/contact/:id/read', authenticate, requireAdmin, contactCtrl.markAsRead);

// ========== SETTINGS ==========
router.get('/settings', authenticate, requireAdmin, settingsCtrl.getAll);
router.put('/settings', authenticate, requireAdmin, settingsCtrl.update);

// ========== DASHBOARD ==========
router.get('/dashboard/stats', authenticate, requireAdmin, dashboardCtrl.getStats);

module.exports = router;