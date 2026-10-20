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

// Nota sobre el mapeo de filas: en Postgres, specs ya vuelve como objeto (la
// columna es jsonb) e is_active como booleano. Los JSON.parse/!! que hacía falta
// con SQLite desaparecieron.

// GET /api/products
async function getAll(req, res) {
  try {
    const { category, search, active, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // El WHERE se arma una vez y lo comparten la consulta de conteo y la de
    // listado. Antes se derivaba el conteo con un replace() por regex sobre el
    // SELECT, que se rompía con solo tocar la lista de columnas.
    const conditions = ['1=1'];
    const params = [];

    if (active !== 'all') {
      conditions.push('p.is_active = true');
    }

    if (category) {
      params.push(category);
      conditions.push(`c.slug = $${params.length}`);
    }

    if (search) {
      // ILIKE, no LIKE: en SQLite LIKE ignoraba mayúsculas, en Postgres no.
      // El mismo término se referencia tres veces con el mismo $n.
      params.push(`%${search}%`);
      conditions.push(
        `(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.brand ILIKE $${params.length})`
      );
    }

    const from = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${conditions.join(' AND ')}
    `;

    const { total } = await db.prepare(`SELECT COUNT(*) as total ${from}`).get(...params);

    params.push(parseInt(limit), offset);
    const products = await db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      ${from}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `).all(...params);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

// GET /api/products/:id or /api/products/slug/:slug
async function getOne(req, res) {
  try {
    const { id } = req.params;
    let product;

    const baseQuery = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;

    if (isNaN(id)) {
      product = await db.prepare(`${baseQuery} WHERE p.slug = $1`).get(id);
    } else {
      product = await db.prepare(`${baseQuery} WHERE p.id = $1`).get(id);
    }

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

// POST /api/products (admin)
async function create(req, res) {
  try {
    const { name, description, price, stock, category_id, brand, image, specs, is_active = 1 } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    let slug = slugify(name);

    // Asegurar unicidad: si el slug ya existe, se agrega un sufijo.
    const existingSlug = await db.prepare('SELECT id FROM products WHERE slug = $1').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // RETURNING * devuelve la fila creada en la misma sentencia: reemplaza al
    // INSERT + SELECT WHERE id = lastInsertRowid de sql.js.
    const inserted = await db.prepare(`
      INSERT INTO products (name, slug, description, price, stock, category_id, brand, image, specs, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `).run(
      name,
      slug,
      description || null,
      price,
      stock || 0,
      category_id || null,
      brand || null,
      image || null,
      specs || null,
      Boolean(is_active)
    );

    res.status(201).json({ message: 'Producto creado', product: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
}

// PUT /api/products/:id (admin)
async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM products WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const {
      name = existing.name,
      description = existing.description,
      price = existing.price,
      stock = existing.stock,
      category_id = existing.category_id,
      brand = existing.brand,
      image = existing.image,
      specs = existing.specs,
      is_active = existing.is_active,
    } = req.body;

    let slug = existing.slug;
    if (name !== existing.name) {
      slug = slugify(name);
      const conflict = await db.prepare('SELECT id FROM products WHERE slug = $1 AND id != $2').get(slug, id);
      if (conflict) slug = `${slug}-${id}`;
    }

    // updated_at lo pone el trigger de la tabla, no la consulta.
    const updated = await db.prepare(`
      UPDATE products SET
        name = $1, slug = $2, description = $3, price = $4, stock = $5,
        category_id = $6, brand = $7, image = $8, specs = $9, is_active = $10
      WHERE id = $11
      RETURNING *
    `).run(
      name, slug, description, price, stock,
      category_id, brand, image,
      specs || null,
      Boolean(is_active),
      id
    );

    res.json({ message: 'Producto actualizado', product: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

// DELETE /api/products/:id (admin)
async function remove(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM products WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await db.prepare('DELETE FROM products WHERE id = $1').run(id);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
