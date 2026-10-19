const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { generateToken } = require('../utils/jwt');
const { sendPasswordResetEmail } = require('../utils/email');

function register(req, res) {
  try {
    const { name, email, password, dni, phone, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) return res.status(409).json({ error: 'El email ya está registrado' });
    if (dni) {
      const existingDni = db.prepare('SELECT id FROM users WHERE dni = ?').get(dni);
      if (existingDni) return res.status(409).json({ error: 'El DNI ya está registrado' });
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, password, dni, role, phone, address)
      VALUES (?, ?, ?, ?, 'customer', ?, ?)
    `).run(name, email, bcrypt.hashSync(password, 10), dni || null, phone || null, address || null);

    const user = db.prepare('SELECT id, name, email, dni, role, phone, address, created_at, updated_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Usuario registrado correctamente', user, token: generateToken(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
}

function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
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

function me(req, res) {
  const user = db.prepare('SELECT id, name, email, dni, role, phone, address, created_at, updated_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user });
}

function forgotPassword(req, res) {
  try {
    const { dni, email } = req.body;
    if (!dni) return res.status(400).json({ error: 'El DNI es obligatorio' });

    const user = db.prepare('SELECT * FROM users WHERE dni = ?').get(dni);
    if (user && email && user.email !== email) {
      return res.status(400).json({ error: 'El email no coincide con el DNI registrado' });
    }

    if (!user) {
      return res.json({ message: 'Si el DNI existe en nuestros registros, recibirás un email con instrucciones.' });
    }

    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);
    const token = uuidv4();
    db.prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(user.id, token, new Date(Date.now() + 3600000).toISOString());

    sendPasswordResetEmail(user, token).then(result => {
      const response = { message: 'Si el DNI existe en nuestros registros, recibirás un email con instrucciones.' };
      if (!result.sent && result.token) {
        response.dev_token = result.token;
        response.dev_note = 'SMTP no configurado. Usá este token para probar.';
      }
      res.json(response);
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
}

function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const reset = db.prepare(`
      SELECT * FROM password_resets
      WHERE token = ? AND used = 0 AND expires_at > ?
    `).get(token, new Date().toISOString());

    if (!reset) return res.status(400).json({ error: 'Token inválido o expirado' });

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(reset.user_id);
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(bcrypt.hashSync(newPassword, 10), reset.user_id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(reset.id);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
}

module.exports = { register, login, me, forgotPassword, resetPassword };