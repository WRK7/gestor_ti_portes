require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3847;
const HOST = process.env.HOST || '0.0.0.0';

const runMigrations = async () => {
  try {
    const migrationFiles = [
      '000_create_users.sql',
      '000_seed_admin.sql',
      '001_create_tasks.sql',
      '002_create_projects.sql',
      '003_create_logs.sql',
      '004_create_notifications.sql',
      '005_create_task_user_timers.sql',
      '006_add_roles.sql',
      '007_add_task_pause_reason.sql',
      '008_create_refresh_tokens.sql',
      '009_add_task_paused_notification_enum.sql',
    ];
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
  let conn;
  try {
    conn = await pool.getConnection();
    conn.release();
    console.log('✅ Conectado ao MySQL');
  } catch (err) {
    console.error('❌ Não foi possível conectar ao MySQL:', err.message);
    console.error('   Verifique: 1) MySQL/MariaDB está rodando?  2) .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)');
    process.exit(1);
  }

  await runMigrations();

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`📡 Rede: http://0.0.0.0:${PORT}`);
  });
};

start();
