const db = require('../db/database');

async function getAll(req, res) {
  try {
    const categories = await db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
}

async function create(req, res) {
  try {
    const { name, description, image } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '');

    const result = await db.prepare(
      'INSERT INTO categories (name, slug, description, image) VALUES ($1, $2, $3, $4) RETURNING *'
    ).run(name, slug, description || null, image || null);

    const category = result.rows[0];
    res.status(201).json({ message: 'Categoría creada', category });
  } catch (error) {
    if (db.isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM categories WHERE id = $1').get(id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });

    const { name = existing.name, description = existing.description, image = existing.image } = req.body;

    await db.prepare(
      'UPDATE categories SET name = $1, description = $2, image = $3 WHERE id = $4'
    ).run(name, description, image, id);

    const category = await db.prepare('SELECT * FROM categories WHERE id = $1').get(id);
    res.json({ message: 'Categoría actualizada', category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM categories WHERE id = $1').get(id);
    if (!existing) return res.status(404).json({ error: 'Categoría no encontrada' });

    await db.prepare('DELETE FROM categories WHERE id = $1').run(id);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
}

module.exports = { getAll, create, update, remove };
