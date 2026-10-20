const bcrypt = require('bcryptjs');
const db = require('../db/database');

// GET /api/users (admin)
async function getAll(req, res) {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT id, name, email, dni, role, phone, address, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      params.push(role);
      sql += ` AND role = $${params.length}`;
    }
    if (search) {
      const term = `%${search}%`;
      params.push(term);
      // Un solo $n para el termino repetido: se envia una sola vez en params.
      sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR dni ILIKE $${params.length})`;
    }

    const countSql = sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) as total FROM');
    const { total } = await db.prepare(countSql).get(...params);

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const users = await db.prepare(sql).all(...params);
    res.json({
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

// PUT /api/users/:id (admin)
async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM users WHERE id = $1').get(id);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    const {
      name = existing.name,
      email = existing.email,
      dni = existing.dni,
      role = existing.role,
      phone = existing.phone,
      address = existing.address,
      password,
    } = req.body;

    if (role && !['admin', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      await db.prepare(`
        UPDATE users SET name=$1, email=$2, dni=$3, role=$4, phone=$5, address=$6, password=$7, updated_at=CURRENT_TIMESTAMP
        WHERE id=$8
      `).run(name, email, dni, role, phone, address, hashed, id);
    } else {
      await db.prepare(`
        UPDATE users SET name=$1, email=$2, dni=$3, role=$4, phone=$5, address=$6, updated_at=CURRENT_TIMESTAMP
        WHERE id=$7
      `).run(name, email, dni, role, phone, address, id);
    }

    const user = await db.prepare('SELECT id, name, email, dni, role, phone, address, created_at FROM users WHERE id = $1').get(id);
    res.json({ message: 'Usuario actualizado', user });
  } catch (error) {
    if (db.isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Email o DNI ya existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

// DELETE /api/users/:id (admin)
async function remove(req, res) {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    }
    const existing = await db.prepare('SELECT id FROM users WHERE id = $1').get(id);
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.prepare('DELETE FROM users WHERE id = $1').run(id);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}

module.exports = { getAll, update, remove };
