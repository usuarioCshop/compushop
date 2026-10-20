const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { generateToken } = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../utils/email');

// Columnas que puede ver el cliente: nunca el hash de la contrasena.
const PUBLIC_USER_COLUMNS = 'id, name, email, dni, role, phone, address, created_at, updated_at';

async function register(req, res) {
  try {
    const { name, email, password, dni, phone, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existingEmail = await db.prepare('SELECT id FROM users WHERE email = $1').get(email);
    if (existingEmail) return res.status(409).json({ error: 'El email ya está registrado' });
    if (dni) {
      const existingDni = await db.prepare('SELECT id FROM users WHERE dni = $1').get(dni);
      if (existingDni) return res.status(409).json({ error: 'El DNI ya está registrado' });
    }

    // RETURNING trae la fila insertada en la misma sentencia: reemplaza al par
    // INSERT + SELECT WHERE id = lastInsertRowid que hacia falta con sql.js.
    const inserted = await db.prepare(`
      INSERT INTO users (name, email, password, dni, role, phone, address)
      VALUES ($1, $2, $3, $4, 'customer', $5, $6)
      RETURNING ${PUBLIC_USER_COLUMNS}
    `).run(name, email, bcrypt.hashSync(password, 10), dni || null, phone || null, address || null);

    const user = inserted.rows[0];
    res.status(201).json({ message: 'Usuario registrado correctamente', user, token: generateToken(user) });
  } catch (e) {
    console.error(e);
    // Las dos comprobaciones de arriba son consultas separadas: entre una y otra
    // el email o el DNI pueden quedar tomados. El UNIQUE de la tabla es la
    // garantia real y aca se traduce a 409.
    if (db.isUniqueViolation(e)) {
      return res.status(409).json({ error: 'El email o el DNI ya están registrados' });
    }
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

    const user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const { password: _, ...safe } = user;
    res.json({ message: 'Login exitoso', user: safe, token: generateToken(safe) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function me(req, res) {
  try {
    const user = await db.prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
}

async function forgotPassword(req, res) {
  try {
    const { dni, email } = req.body;
    if (!dni) return res.status(400).json({ error: 'El DNI es obligatorio' });

    const user = await db.prepare('SELECT * FROM users WHERE dni = $1').get(dni);
    if (user && email && user.email !== email) {
      return res.status(400).json({ error: 'El email no coincide con el DNI registrado' });
    }

    if (!user) {
      return res.json({ message: 'Si el DNI existe en nuestros registros, recibirás un email con instrucciones.' });
    }

    await db.prepare('UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false').run(user.id);
    const token = uuidv4();
    await db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)')
      .run(user.id, token, new Date(Date.now() + 3600000).toISOString());

    const result = await sendPasswordResetEmail(user, token);
    const response = { message: 'Si el DNI existe en nuestros registros, recibirás un email con instrucciones.' };
    if (!result.sent && result.token) {
      response.dev_token = result.token;
      response.dev_note = 'SMTP no configurado. Usá este token para probar.';
    }
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    // expires_at es timestamptz: la comparacion la resuelve Postgres, no una
    // comparacion de strings como en SQLite.
    const reset = await db.prepare(`
      SELECT * FROM password_resets
      WHERE token = $1 AND used = false AND expires_at > $2
    `).get(token, new Date().toISOString());

    if (!reset) return res.status(400).json({ error: 'Token inválido o expirado' });

    const user = await db.prepare('SELECT id FROM users WHERE id = $1').get(reset.user_id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    // updated_at lo pone el trigger de la tabla.
    await db.prepare('UPDATE users SET password = $1 WHERE id = $2')
      .run(bcrypt.hashSync(newPassword, 10), reset.user_id);
    await db.prepare('UPDATE password_resets SET used = true WHERE id = $1').run(reset.id);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword };
