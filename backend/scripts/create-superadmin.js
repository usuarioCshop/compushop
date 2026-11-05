// Crea o resetea la cuenta superadmin a partir de variables de entorno.
// Correr UNA vez para inicializar, o cada vez que te olvides la contrasena:
//   SUPERADMIN_EMAIL=super@compushop.com SUPERADMIN_PASSWORD='secreto-largo' npm run create-superadmin
//
// El superadmin es un usuario real en la base (login normal con bcrypt).
// La contrasena NUNCA se versiona: vive en el entorno del que corre el script.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db/database');

const EMAIL = process.env.SUPERADMIN_EMAIL;
const PASSWORD = process.env.SUPERADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Faltan variables de entorno: SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD');
  console.error('Ejemplo: SUPERADMIN_EMAIL=super@compushop.com SUPERADMIN_PASSWORD=secreto-muy-largo npm run create-superadmin');
  process.exit(1);
}
if (PASSWORD.length < 12) {
  console.error('La contrasena del superadmin debe tener al menos 12 caracteres.');
  process.exit(1);
}

(async () => {
  // Ojo: migrate.js/seed.js prefieren DATABASE_URL_UNPOOLED; aca honramos la
  // misma convencion para que apunte al mismo lado que el resto de scripts.
  if (process.env.DATABASE_URL_UNPOOLED) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
  }

  const hash = bcrypt.hashSync(PASSWORD, 10);
  const existing = await db.prepare('SELECT id FROM users WHERE email = $1').get(EMAIL);

  if (existing) {
    await db.prepare(`
      UPDATE users SET role = 'superadmin', password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `).run(hash, existing.id);
    console.log(`Superadmin actualizado: ${EMAIL} (id ${existing.id})`);
  } else {
    const result = await db.prepare(`
      INSERT INTO users (name, email, password, role, dni, phone, address)
      VALUES ($1, $2, $3, 'superadmin', NULL, NULL, NULL)
      RETURNING id
    `).run('Super Administrador', EMAIL, hash);
    console.log(`Superadmin creado: ${EMAIL} (id ${result.rows[0].id})`);
  }
  process.exit(0);
})().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
