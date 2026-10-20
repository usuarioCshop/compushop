const db = require('../db/database');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

async function getAll(req, res) {
  try {
    const { active } = req.query;
    let sql = 'SELECT * FROM services WHERE 1=1';
    if (active !== 'all') {
      sql += ' AND is_active = true';
    }
    sql += ' ORDER BY created_at DESC';

    const services = (await db.prepare(sql).all()).map(s => ({
      ...s,
      is_active: !!s.is_active,
    }));

    res.json({ services });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
}

async function getOne(req, res) {
  try {
    const { id } = req.params;
    let service;

    if (isNaN(id)) {
      service = await db.prepare('SELECT * FROM services WHERE slug = $1').get(id);
    } else {
      service = await db.prepare('SELECT * FROM services WHERE id = $1').get(id);
    }

    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    service.is_active = !!service.is_active;
    res.json({ service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
}

async function create(req, res) {
  try {
    const { name, description, price, duration, image, is_active = 1 } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    let slug = slugify(name);
    const existing = await db.prepare('SELECT id FROM services WHERE slug = $1').get(slug);
    if (existing) slug = `${slug}-${Date.now()}`;

    const result = await db.prepare(`
      INSERT INTO services (name, slug, description, price, duration, image, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `).run(name, slug, description || null, price, duration || null, image || null, is_active ? true : false);

    const service = result.rows[0];
    res.status(201).json({ message: 'Servicio creado', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM services WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    const {
      name = existing.name,
      description = existing.description,
      price = existing.price,
      duration = existing.duration,
      image = existing.image,
      is_active = existing.is_active,
    } = req.body;

    let slug = existing.slug;
    if (name !== existing.name) {
      slug = slugify(name);
      const conflict = await db.prepare('SELECT id FROM services WHERE slug = $1 AND id != $2').get(slug, id);
      if (conflict) slug = `${slug}-${id}`;
    }

    await db.prepare(`
      UPDATE services SET
        name = $1, slug = $2, description = $3, price = $4, duration = $5, image = $6, is_active = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
    `).run(name, slug, description, price, duration, image, is_active ? true : false, id);

    const service = await db.prepare('SELECT * FROM services WHERE id = $1').get(id);
    res.json({ message: 'Servicio actualizado', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM services WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    await db.prepare('DELETE FROM services WHERE id = $1').run(id);
    res.json({ message: 'Servicio eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
