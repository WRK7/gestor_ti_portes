require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3847;
const HOST = process.env.HOST || '0.0.0.0';

const runMigrations = async () => {
  try {
    const migrationFiles = ['000_create_users.sql', '000_seed_admin.sql', '001_create_tasks.sql', '002_create_projects.sql', '003_create_logs.sql'];
    let sql = '';
    for (const file of migrationFiles) {
      sql += fs.readFileSync(path.join(__dirname, 'src', 'migrations', file), 'utf8') + '\n';
    }

    // Split by semicolon and run each statement individually (MariaDB requirement)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        console.warn('⚠️  Migration (ignorado):', err.message);
      }
    }

    console.log('✅ Migrations finalizadas com sucesso');
  } catch (err) {
    console.error('⚠️  Erro nas migrations:', err.message);
  }
};

const start = async () => {
  await runMigrations();

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`📡 Rede: http://0.0.0.0:${PORT}`);
  });
};

start();
