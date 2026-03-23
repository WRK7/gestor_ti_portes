/**
 * Cria o primeiro administrador a partir do .env (uma vez por ambiente).
 * Não commite senhas. Defina no .env:
 *   ADMIN_USERNAME=...
 *   ADMIN_PASSWORD=...
 * Opcional: ADMIN_EMAIL, ADMIN_NAME, ADMIN_ROLE (superadmin|admin)
 *
 * Uso: npm run bootstrap:admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

const REQUIRED = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'];

async function main() {
  for (const key of REQUIRED) {
    if (!process.env[key] || String(process.env[key]).trim() === '') {
      console.log(`ℹ️  ${key} não definido — bootstrap ignorado (defina no .env para criar o admin).`);
      process.exit(0);
    }
  }

  const username = String(process.env.ADMIN_USERNAME).trim();
  const password = String(process.env.ADMIN_PASSWORD);
  const email = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim() : null;
  const name = process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : username;
  const role = ['superadmin', 'admin'].includes(process.env.ADMIN_ROLE)
    ? process.env.ADMIN_ROLE
    : 'superadmin';

  const hashed = await bcrypt.hash(password, 12);

  try {
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, name, role, active, authorizationStatus, approved_at)
       VALUES (?, ?, ?, ?, ?, 1, 'approved', NOW())`,
      [username, email, hashed, name, role]
    );
    console.log(`✅ Usuário administrativo criado: id=${result.insertId}, username=${username}, role=${role}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('ℹ️  Usuário ou e-mail já existe — nada a fazer.');
      process.exit(0);
    }
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
