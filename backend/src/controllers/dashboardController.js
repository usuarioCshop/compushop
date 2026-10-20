const db = require('../db/database');

// GET /api/dashboard/stats (admin)
async function getStats(req, res) {
  try {
    const productsCount = (await db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = true').get()).c;
    const servicesCount = (await db.prepare('SELECT COUNT(*) as c FROM services WHERE is_active = true').get()).c;
    const usersCount = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get()).c;
    const ordersCount = (await db.prepare('SELECT COUNT(*) as c FROM orders').get()).c;
    const pendingOrders = (await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending','confirmed','processing')").get()).c;
    const unreadMessages = (await db.prepare('SELECT COUNT(*) as c FROM contact_messages WHERE is_read = false').get()).c;

    const revenue = (await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders
      WHERE status NOT IN ('cancelled')
    `).get()).total;

    const recentOrders = await db.prepare(`
      SELECT id, order_number, customer_name, total, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    const lowStock = await db.prepare(`
      SELECT id, name, stock, price
      FROM products
      WHERE is_active = true AND stock <= 5
      ORDER BY stock ASC
      LIMIT 10
    `).all();

    // Ventas por mes (últimos 6 meses)
    const salesByMonth = await db.prepare(`
      SELECT to_char(created_at, 'YYYY-MM') as month, SUM(total) as total, COUNT(*) as orders
      FROM orders
      WHERE status NOT IN ('cancelled')
        AND created_at >= now() - interval '6 months'
      GROUP BY month
      ORDER BY month
    `).all();

    res.json({
      stats: {
        productsCount,
        servicesCount,
        usersCount,
        ordersCount,
        pendingOrders,
        unreadMessages,
        revenue,
      },
      recentOrders,
      lowStock,
      salesByMonth,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

module.exports = { getStats };
