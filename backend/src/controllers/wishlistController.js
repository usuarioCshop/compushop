const db = require('../db/database');

async function getAll(req, res) {
  try {
    const userId = req.user.id;
    const items = await db.prepare(`
      SELECT w.id, w.product_id, w.created_at, p.name, p.slug, p.price, p.image, p.stock, p.is_active, p.brand, p.description
      FROM wishlist w
      JOIN products p ON p.id = w.product_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `).all(userId);
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener favoritos' });
  }
}

async function add(req, res) {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({ error: 'product_id es obligatorio' });
    }

    await db.prepare(`
      INSERT INTO wishlist (user_id, product_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, product_id) DO NOTHING
    `).run(userId, product_id);

    res.status(201).json({ message: 'Agregado a favoritos' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar a favoritos' });
  }
}

async function remove(req, res) {
  try {
    const userId = req.user.id;
    const { product_id } = req.params;
    await db.prepare('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2').run(userId, product_id);
    res.json({ message: 'Eliminado de favoritos' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar de favoritos' });
  }
}

module.exports = { getAll, add, remove };
