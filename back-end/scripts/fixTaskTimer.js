/**
 * Corrige o timer de uma tarefa aplicando o limite de 8h por dia corrido.
 * Útil para tarefas que ficaram com o timer rodando sem ser pausado.
 *
 * Uso: node scripts/fixTaskTimer.js "Auditaai V.2"
 *   ou: node scripts/fixTaskTimer.js 42        (pelo ID numérico da tarefa)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const MAX_SECONDS_PER_DAY = 8 * 3600; // 28800

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('❌  Informe o nome ou ID da tarefa. Ex:\n   node scripts/fixTaskTimer.js "Auditaai V.2"');
    process.exit(1);
  }

  const byId = /^\d+$/.test(arg.trim());
  const [tasks] = await pool.query(
    byId
      ? 'SELECT id, title, status FROM tasks_ti WHERE id = ?'
      : 'SELECT id, title, status FROM tasks_ti WHERE title = ?',
    [byId ? parseInt(arg) : arg]
  );

  if (!tasks.length) {
    console.error(`❌  Tarefa não encontrada: "${arg}"`);
    process.exit(1);
  }

  const task = tasks[0];
  console.log(`\n🔍  Tarefa encontrada: [${task.id}] ${task.title} (${task.status})`);

  const [timers] = await pool.query(
    'SELECT user_id, dev_seconds, timer_started_at FROM task_user_timers_ti WHERE task_id = ?',
    [task.id]
  );

  if (!timers.length) {
    console.log('ℹ️   Nenhum timer encontrado para esta tarefa.');
    await pool.end();
    return;
  }

  const running = timers.filter(t => t.timer_started_at);
  if (!running.length) {
    console.log('ℹ️   Nenhum timer está rodando no momento. Nada a corrigir.');
    await pool.end();
    return;
  }

  console.log(`\n⏱️   Timers em execução: ${running.length}`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let totalBefore = 0;
    let totalAfter = 0;

    for (const timer of timers) {
      totalBefore += timer.dev_seconds || 0;

      if (!timer.timer_started_at) {
        totalAfter += timer.dev_seconds || 0;
        continue;
      }

      const started = new Date(timer.timer_started_at);
      const now = new Date();
      const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000));

      // Dias corridos (inclusive o dia de início)
      const startDay = new Date(started.getFullYear(), started.getMonth(), started.getDate());
      const today    = new Date(now.getFullYear(),     now.getMonth(),     now.getDate());
      const days = Math.floor((today - startDay) / 86400000) + 1;

      const cappedElapsed = Math.min(elapsedSeconds, days * MAX_SECONDS_PER_DAY);
      const newDevSeconds = (timer.dev_seconds || 0) + cappedElapsed;

      const elapsedH = Math.floor(elapsedSeconds / 3600);
      const elapsedM = Math.floor((elapsedSeconds % 3600) / 60);
      const cappedH  = Math.floor(cappedElapsed / 3600);
      const cappedM  = Math.floor((cappedElapsed % 3600) / 60);

      console.log(`   user_id=${timer.user_id}: rodando ${elapsedH}h ${elapsedM}min → corrigido para +${cappedH}h ${cappedM}min (${days} dias × 8h)`);

      // Aplica a correção: acumula tempo com cap e reseta o timer_started_at para agora
      await conn.query(
        `UPDATE task_user_timers_ti
         SET dev_seconds = ?, timer_started_at = NOW()
         WHERE task_id = ? AND user_id = ?`,
        [newDevSeconds, task.id, timer.user_id]
      );

      totalAfter += newDevSeconds;
    }

    await conn.commit();

    const beforeH = Math.floor(totalBefore / 3600);
    const beforeM = Math.floor((totalBefore % 3600) / 60);
    const afterH  = Math.floor(totalAfter  / 3600);
    const afterM  = Math.floor((totalAfter  % 3600) / 60);

    console.log(`\n✅  Correção aplicada!`);
    console.log(`   Antes : ${beforeH}h ${beforeM}min`);
    console.log(`   Depois: ${afterH}h ${afterM}min`);
    console.log(`\n   (O timer segue rodando a partir de agora normalmente)\n`);
  } catch (err) {
    await conn.rollback();
    console.error('❌  Erro ao corrigir:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
