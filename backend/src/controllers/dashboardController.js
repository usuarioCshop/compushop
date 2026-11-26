const db = require('../db/database');

// GET /api/dashboard/stats (admin)
async function getStats(req, res) {
  try {
    const productsCount = (await db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = true').get()).c;
    const servicesCount = (await db.prepare('SELECT COUNT(*) as c FROM services WHERE is_active = true').get()).c;
    const usersCount = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get()).c;
    const ordersCount = (await db.prepare('SELECT COUNT(*) as c FROM orders').get()).c;
    const pendingOrders = (await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pendiente','confirmado','preparando')").get()).c;
    const unreadMessages = (await db.prepare('SELECT COUNT(*) as c FROM contact_messages WHERE is_read = false').get()).c;

    const revenue = (await db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM orders
      WHERE status NOT IN ('cancelado')
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
      WHERE status NOT IN ('cancelado')
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

const { spawn } = require('child_process');

function resolvePgDump() {
  const candidates = [
    'pg_dump',
    '/usr/bin/pg_dump',
    '/usr/local/bin/pg_dump',
    '/usr/lib/postgresql/16/bin/pg_dump',
    '/usr/lib/postgresql/15/bin/pg_dump',
    '/usr/lib/postgresql/14/bin/pg_dump',
  ];
  return candidates;
}

// GET /api/dashboard/backup (admin/superadmin)
async function backupDatabase(req, res) {
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ error: 'DATABASE_URL no configurada' });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `compushop-backup-${stamp}.sql`;

  const candidates = resolvePgDump();
  let tried = 0;
  let responded = false;

  const tryNext = () => {
    if (responded) return;
    if (tried >= candidates.length) {
      responded = true;
      return res.status(501).json({ error: 'pg_dump no está disponible en el servidor. Instalá postgresql-client para habilitar backups.' });
    }
    const bin = candidates[tried++];
    const args = ['--dbname', dbUrl, '--no-owner', '--no-privileges', '--format=plain'];
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    let started = false;

    child.on('error', (err) => {
      if (started || responded) return;
      if (err.code === 'ENOENT') {
        return tryNext();
      }
      responded = true;
      console.error('Error ejecutando pg_dump:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Error al generar backup' });
    });

    child.stdout.once('data', (chunk) => {
      if (responded) return;
      started = true;
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.write(chunk);
      child.stdout.pipe(res);
    });

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (responded) return;
      if (!started) {
        responded = true;
        if (code !== 0) {
          console.error('pg_dump falló:', stderr);
          if (!res.headersSent) res.status(500).json({ error: 'Error al generar backup de la base de datos' });
        } else if (!res.headersSent) {
          res.status(500).json({ error: 'pg_dump no generó salida' });
        }
        return;
      }
      if (code !== 0 && !res.headersSent) {
        responded = true;
        console.error('pg_dump falló:', stderr);
        res.status(500).json({ error: 'Error al generar backup de la base de datos' });
      }
    });
  };

  tryNext();
}

module.exports = { getStats, backupDatabase };
