const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `CS${y}${m}${d}-${rand}`;
}

// POST /api/orders  (confirmar pedido desde el carrito)
async function create(req, res) {
  try {
    const {
      items, // [{ type: 'product'|'service', id, quantity, name, price }]
      shipping_address,
      notes,
      customer_name,
      customer_email,
      customer_phone,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un ítem' });
    }

    if (!customer_name || !customer_email) {
      return res.status(400).json({ error: 'Nombre y email del cliente son obligatorios' });
    }

    // La tabla tiene un CHECK que solo acepta 'product' o 'service'. Sin esta
    // validación, un tipo inválido saldría como 500 desde el motor en vez de 400.
    const tipoInvalido = items.find((item) => item.type !== 'product' && item.type !== 'service');
    if (tipoInvalido) {
      return res.status(400).json({ error: 'Tipo de ítem inválido' });
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = generateOrderNumber();
    const userId = req.user ? req.user.id : null;

    // Todo el pedido ocurre en UNA transacción, con el runner `tx` atado a esa
    // conexión. Usar db.prepare() acá adentro tomaría otra conexión del pool y
    // partiría la transacción en dos.
    const orderId = await db.transaction(async (tx) => {
      const insertedOrder = await tx.prepare(`
        INSERT INTO orders (order_number, status, total, shipping_address, notes, customer_name, customer_email, customer_phone, user_id)
        VALUES ($1, 'confirmed', $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `).run(orderNumber, total, shipping_address || null, notes || null, customer_name, customer_email, customer_phone || null, userId);

      const newOrderId = insertedOrder.rows[0].id;

      const insertItem = tx.prepare(`
        INSERT INTO order_items (order_id, product_id, service_id, name, price, quantity, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `);
      const updateStock = tx.prepare(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3'
      );

      for (const item of items) {
        const productId = item.type === 'product' ? item.id : null;
        const serviceId = item.type === 'service' ? item.id : null;

        await insertItem.run(newOrderId, productId, serviceId, item.name, item.price, item.quantity, item.type);

        // Descontar stock solo de productos
        if (item.type === 'product') {
          const info = await updateStock.run(item.quantity, item.id, item.quantity);
          if (info.changes === 0) {
            throw new Error(`Stock insuficiente para: ${item.name}`);
          }
        }
      }

      return newOrderId;
    });

    const order = await db.prepare('SELECT * FROM orders WHERE id = $1').get(orderId);
    const orderItems = await db.prepare('SELECT * FROM order_items WHERE order_id = $1').all(orderId);

    res.status(201).json({
      message: 'Pedido confirmado correctamente',
      order: { ...order, items: orderItems },
    });
  } catch (error) {
    console.error(error);
    // Este endpoint es público: no devolvemos el mensaje crudo de Postgres, que
    // nombra tablas y constraints. Los errores de negocio que lanzamos nosotros
    // no traen `code`, así que igual llegan al usuario con su texto.
    if (error.code) {
      return res.status(400).json({ error: 'No se pudo confirmar el pedido' });
    }
    res.status(400).json({ error: error.message || 'Error al crear el pedido' });
  }
}

// GET /api/orders (admin: todos | customer: solo los suyos)
async function getAll(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      sql += ` AND user_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = await db.prepare(countSql).get(...params);

    params.push(parseInt(limit), offset);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const orders = await db.prepare(sql).all(...params);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
}

// GET /api/orders/:id
async function getOne(req, res) {
  try {
    const { id } = req.params;
    const order = await db.prepare('SELECT * FROM orders WHERE id = $1').get(id);

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Solo admin o el dueño
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const items = await db.prepare('SELECT * FROM order_items WHERE order_id = $1').all(id);
    res.json({ order: { ...order, items } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
}

// PUT /api/orders/:id/status (admin)
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const order = await db.prepare('SELECT * FROM orders WHERE id = $1').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // updated_at lo pone el trigger de la tabla.
    const updated = await db.prepare(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *'
    ).run(status, id);

    res.json({ message: 'Estado actualizado', order: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

module.exports = { create, getAll, getOne, updateStatus };
