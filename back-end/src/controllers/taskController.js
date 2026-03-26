const pool = require('../config/database');
const { record } = require('../utils/log');
const { notifyMultiple } = require('./notificationController');

const toMysqlDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const loadAssignees = async (taskIds) => {
  if (!taskIds.length) return {};
  const [rows] = await pool.query(
    `SELECT ta.task_id, u.id, u.name, u.username,
            COALESCE(tut.dev_seconds, 0)
              + GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, tut.timer_started_at, NOW()), 0), 0)
              AS user_dev_seconds,
            tut.timer_started_at IS NOT NULL AS timer_active
     FROM task_assignees_ti ta
     JOIN users u ON u.id = ta.user_id
     LEFT JOIN task_user_timers_ti tut ON tut.task_id = ta.task_id AND tut.user_id = ta.user_id
     WHERE ta.task_id IN (?)`,
    [taskIds]
  );
  return rows.reduce((map, row) => {
    if (!map[row.task_id]) map[row.task_id] = [];
    map[row.task_id].push({
      id: row.id,
      name: row.name,
      username: row.username,
      timer_active: !!row.timer_active,
      user_dev_seconds: row.user_dev_seconds || 0,
    });
    return map;
  }, {});
};

const setAssignees = async (conn, taskId, assigneeIds) => {
  const [oldRows] = await conn.query(
    'SELECT user_id FROM task_assignees_ti WHERE task_id = ?', [taskId]
  );
  const oldIds = oldRows.map(r => r.user_id);

  await conn.query('DELETE FROM task_assignees_ti WHERE task_id = ?', [taskId]);
  if (assigneeIds && assigneeIds.length > 0) {
    const values = assigneeIds.map(uid => [taskId, uid]);
    await conn.query('INSERT INTO task_assignees_ti (task_id, user_id) VALUES ?', [values]);
  }

  const removedIds = oldIds.filter(id => !assigneeIds.includes(id));
  if (removedIds.length) {
    await conn.query(
      'DELETE FROM task_user_timers_ti WHERE task_id = ? AND user_id IN (?)',
      [taskId, removedIds]
    );
  }

  const addedIds = assigneeIds.filter(id => !oldIds.includes(id));
  if (addedIds.length) {
    const timerValues = addedIds.map(uid => [taskId, uid, 0, null]);
    await conn.query(
      'INSERT IGNORE INTO task_user_timers_ti (task_id, user_id, dev_seconds, timer_started_at) VALUES ?',
      [timerValues]
    );
  }
};

const normalizeAssignees = (assignees) => {
  if (!assignees || !Array.isArray(assignees)) return [];
  return assignees
    .map(a => (typeof a === 'object' ? a.id : a))
    .filter(id => id != null && !isNaN(Number(id)))
    .map(Number);
};

const updateOverdueTasks = async () => {
  const [nowOverdue] = await pool.query(`
    SELECT id, title FROM tasks_ti
    WHERE status IN ('pending', 'paused') AND due_date < NOW()
  `);

  if (nowOverdue.length) {
    await pool.query(`
      UPDATE tasks_ti
      SET status = 'overdue', updated_at = NOW()
      WHERE status IN ('pending', 'paused') AND due_date < NOW()
    `);

    const taskIds = nowOverdue.map(t => t.id);
    const [assignees] = await pool.query(
      'SELECT task_id, user_id FROM task_assignees_ti WHERE task_id IN (?)', [taskIds]
    );
    const byTask = {};
    assignees.forEach(a => { (byTask[a.task_id] ||= []).push(a.user_id); });

    for (const task of nowOverdue) {
      const uids = byTask[task.id] || [];
      if (uids.length) {
        await notifyMultiple(
          uids, 'task_overdue', 'Tarefa atrasada',
          `A tarefa "${task.title}" ultrapassou o prazo.`,
          '/dashboard'
        );
      }
    }
  }
};

// Pausa todos os timers do USUÁRIO em outras tarefas (não afeta outros usuários)
const pauseAllForUser = async (conn, userId, excludeTaskId) => {
  await conn.query(
    `UPDATE task_user_timers_ti
     SET dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
         timer_started_at = NULL
     WHERE user_id = ? AND task_id != ? AND timer_started_at IS NOT NULL`,
    [userId, excludeTaskId]
  );

  // Recalcular status das tarefas onde esse user tinha timer ativo:
  // se nenhum user restante tem timer ativo, a tarefa vira 'paused'
  await conn.query(
    `UPDATE tasks_ti t
     SET t.status = 'paused', t.updated_at = NOW()
     WHERE t.id != ?
       AND t.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM task_user_timers_ti tut
         WHERE tut.task_id = t.id AND tut.timer_started_at IS NOT NULL
       )`,
    [excludeTaskId]
  );
};

// Recalcula o status de uma tarefa com base nos timers individuais
const recalcTaskStatus = async (conn, taskId) => {
  const [active] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM task_user_timers_ti WHERE task_id = ? AND timer_started_at IS NOT NULL',
    [taskId]
  );
  const hasActive = active[0].cnt > 0;

  const [task] = await conn.query('SELECT status FROM tasks_ti WHERE id = ?', [taskId]);
  if (!task.length || task[0].status === 'completed' || task[0].status === 'overdue') return;

  const newStatus = hasActive ? 'pending' : 'paused';
  if (task[0].status !== newStatus) {
    await conn.query(
      'UPDATE tasks_ti SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, taskId]
    );
  }
};

// current_dev_seconds = sum of all user timers (stored + running)
// GREATEST(..., 0) garante que nunca temos valores negativos (defasagem de timezone)
// Fallback = 0 (não usar t.dev_seconds do modelo antigo)
const TIMER_SUM_SQL = `
  COALESCE((
    SELECT SUM(
      tut.dev_seconds + GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, tut.timer_started_at, NOW()), 0), 0)
    )
    FROM task_user_timers_ti tut WHERE tut.task_id = t.id
  ), 0)`;

const TASK_SELECT = `
  SELECT
    t.id, t.title, t.description, t.status, t.priority,
    t.due_date, t.completed_at, t.dev_seconds, t.timer_started_at, t.pause_reason,
    t.created_at, t.updated_at,
    ${TIMER_SUM_SQL} AS current_dev_seconds,
    c.id AS category_id, c.name AS category_name, c.color AS category_color,
    EXISTS(SELECT 1 FROM projects_ti p WHERE p.source_task_id = t.id) AS has_bonif_project
  FROM tasks_ti t
  LEFT JOIN task_categories_ti c ON t.category_id = c.id`;

const taskSelectForUser = (userId) => `
  SELECT
    t.id, t.title, t.description, t.status, t.priority,
    t.due_date, t.completed_at, t.dev_seconds, t.timer_started_at, t.pause_reason,
    t.created_at, t.updated_at,
    ${TIMER_SUM_SQL} AS current_dev_seconds,
    COALESCE(my.dev_seconds, 0) + GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, my.timer_started_at, NOW()), 0), 0) AS my_dev_seconds,
    my.timer_started_at AS my_timer_started_at,
    c.id AS category_id, c.name AS category_name, c.color AS category_color,
    EXISTS(SELECT 1 FROM projects_ti p WHERE p.source_task_id = t.id) AS has_bonif_project
  FROM tasks_ti t
  LEFT JOIN task_categories_ti c ON t.category_id = c.id
  LEFT JOIN task_user_timers_ti my ON my.task_id = t.id AND my.user_id = ${Number(userId)}`;

const getTodayStats = async (req, res) => {
  try {
    await updateOverdueTasks();
    const [rows] = await pool.query(
      `SELECT
        COUNT(*)                               AS total,
        COALESCE(SUM(status = 'completed'), 0) AS completed,
        COALESCE(SUM(status = 'overdue'),   0) AS overdue,
        COALESCE(SUM(status = 'pending'),   0) AS pending,
        COALESCE(SUM(status = 'paused'),    0) AS paused
      FROM tasks_ti`
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro stats:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getAllTasks = async (req, res) => {
  try {
    await updateOverdueTasks();
    const { date, status } = req.query;
    const userId = req.user?.id;
    let where = 'WHERE 1=1';
    const params = [];

    if (date) {
      const d = new Date(date);
      where += ' AND t.due_date >= ? AND t.due_date < ?';
      params.push(
        new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      );
    }
    if (status) { where += ' AND t.status = ?'; params.push(status); }

    const selectSql = userId ? taskSelectForUser(userId) : TASK_SELECT;

    const [tasks] = await pool.query(
      `${selectSql}
      ${where}
      ORDER BY
        CASE t.status
          WHEN 'overdue'   THEN 1
          WHEN 'pending'   THEN 2
          WHEN 'paused'    THEN 3
          WHEN 'completed' THEN 4
          ELSE 5
        END, t.due_date ASC`,
      params
    );

    if (tasks.length === 0) return res.json([]);

    const assigneesMap = await loadAssignees(tasks.map(t => t.id));
    const result = tasks.map(t => ({
      ...t,
      assignees: assigneesMap[t.id] || [],
    }));

    return res.json(result);
  } catch (err) {
    console.error('Erro buscar tarefas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createTask = async (req, res) => {
  const { title, description, due_date, priority, assignees, category_id } = req.body;
  if (!title || !due_date) {
    return res.status(400).json({ error: 'Título e data de vencimento são obrigatórios' });
  }

  const ids = normalizeAssignees(assignees);
  if (ids.length === 0) {
    return res.status(400).json({ error: 'É obrigatório atribuir pelo menos uma pessoa à tarefa' });
  }

  if (new Date(due_date) <= new Date()) {
    return res.status(400).json({ error: 'A data de vencimento deve ser no futuro' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Criador é assignee? Se sim, inicia o timer dele; senão, task começa pausada
    const creatorIsAssignee = ids.includes(req.user.id);

    const [result] = await conn.query(
      `INSERT INTO tasks_ti (title, description, due_date, priority, category_id, created_by,
       status, timer_started_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NOW())`,
      [title, description || null, toMysqlDate(due_date), priority || 'medium',
       category_id || null, req.user.id, creatorIsAssignee ? 'pending' : 'paused']
    );
    const taskId = result.insertId;

    if (creatorIsAssignee) {
      await pauseAllForUser(conn, req.user.id, taskId);
    }

    await conn.query('DELETE FROM task_assignees_ti WHERE task_id = ?', [taskId]);
    const values = ids.map(uid => [taskId, uid]);
    await conn.query('INSERT INTO task_assignees_ti (task_id, user_id) VALUES ?', [values]);

    // Timers individuais: todos começam com NULL (parado)
    const timerValues = ids.map(uid => [taskId, uid, 0]);
    await conn.query(
      'INSERT INTO task_user_timers_ti (task_id, user_id, dev_seconds) VALUES ?',
      [timerValues]
    );

    // Se criador é assignee, inicia o timer dele via SQL NOW()
    if (creatorIsAssignee) {
      await conn.query(
        'UPDATE task_user_timers_ti SET timer_started_at = NOW() WHERE task_id = ? AND user_id = ?',
        [taskId, req.user.id]
      );
    }

    await conn.commit();

    const userId = req.user.id;
    const [tasks] = await pool.query(`${taskSelectForUser(userId)} WHERE t.id = ?`, [taskId]);
    const assigneesMap = await loadAssignees([taskId]);
    const priorityLabel = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }[priority] || priority;
    const dueStr = due_date ? new Date(due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    await record(req.user, 'criou', 'tarefa', taskId, title, `Vencimento: ${dueStr}, Prioridade: ${priorityLabel}`);

    const notifIds = ids.filter(uid => uid !== req.user.id);
    if (notifIds.length) {
      await notifyMultiple(
        notifIds, 'task_assigned', 'Nova tarefa atribuída',
        `Você foi designado para a tarefa "${title}" (vencimento: ${dueStr}).`,
        '/dashboard'
      );
    }

    return res.status(201).json({ ...tasks[0], assignees: assigneesMap[taskId] || [] });
  } catch (err) {
    await conn.rollback();
    console.error('Erro criar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, priority, status, assignees, category_id } = req.body;

  if (assignees !== undefined) {
    const ids = normalizeAssignees(assignees);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'É obrigatório manter pelo menos uma pessoa atribuída à tarefa' });
    }
  }

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query('SELECT id FROM tasks_ti WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });

    let completedAtExpr = 'completed_at';
    if (status === 'completed') completedAtExpr = 'NOW()';
    else if (status === 'pending') completedAtExpr = 'NULL';

    await conn.beginTransaction();

    await conn.query(
      `UPDATE tasks_ti SET
        title       = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date    = COALESCE(?, due_date),
        priority    = COALESCE(?, priority),
        status      = CASE
          -- Não permite manter "overdue" quando o prazo foi movido para o futuro.
          WHEN COALESCE(?, due_date) > NOW() AND COALESCE(?, status) = 'overdue' THEN 'pending'
          ELSE COALESCE(?, status)
        END,
        pause_reason = CASE
          WHEN COALESCE(?, status) IN ('pending', 'completed', 'overdue') THEN NULL
          ELSE pause_reason
        END,
        category_id = COALESCE(?, category_id),
        completed_at = ${completedAtExpr},
        updated_at  = NOW()
      WHERE id = ?`,
      [title, description, toMysqlDate(due_date), priority, toMysqlDate(due_date), status, status, status, category_id, id]
    );

    if (assignees !== undefined) {
      await setAssignees(conn, id, normalizeAssignees(assignees));
    }

    await conn.commit();

    const userId = req.user.id;
    const [tasks] = await pool.query(`${taskSelectForUser(userId)} WHERE t.id = ?`, [id]);
    const assigneesMap = await loadAssignees([parseInt(id)]);
    await record(req.user, 'editou', 'tarefa', parseInt(id), tasks[0]?.title || title, 'Tarefa atualizada');
    return res.json({ ...tasks[0], assignees: assigneesMap[parseInt(id)] || [] });
  } catch (err) {
    await conn.rollback();
    console.error('Erro atualizar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const pauseTask = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const reason = (req.body?.reason || '').trim();
  const conn = await pool.getConnection();

  try {
    if (!reason) {
      conn.release();
      return res.status(400).json({ error: 'Informe o motivo da pausa' });
    }

    const [rows] = await conn.query('SELECT id, status, title FROM tasks_ti WHERE id = ?', [id]);
    if (rows.length === 0) { conn.release(); return res.status(404).json({ error: 'Tarefa não encontrada' }); }
    if (rows[0].status === 'completed') { conn.release(); return res.status(400).json({ error: 'Tarefa já concluída' }); }

    const [timer] = await conn.query(
      'SELECT dev_seconds, timer_started_at FROM task_user_timers_ti WHERE task_id = ? AND user_id = ?',
      [id, userId]
    );
    if (!timer.length || !timer[0].timer_started_at) {
      conn.release();
      return res.status(400).json({ error: 'Seu timer já está pausado nesta tarefa' });
    }

    await conn.beginTransaction();

    // Acumula tempo do USUÁRIO
    await conn.query(
      `UPDATE task_user_timers_ti SET
        dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
        timer_started_at = NULL
      WHERE task_id = ? AND user_id = ?`,
      [id, userId]
    );

    // Recalcula status da tarefa
    await recalcTaskStatus(conn, parseInt(id));

    await conn.query(
      `UPDATE tasks_ti
       SET pause_reason = CASE WHEN status = 'paused' THEN ? ELSE pause_reason END,
           updated_at = NOW()
       WHERE id = ?`,
      [reason, id]
    );

    await conn.commit();

    const [updated] = await pool.query(
      'SELECT dev_seconds FROM task_user_timers_ti WHERE task_id = ? AND user_id = ?',
      [id, userId]
    );
    console.log(`⏸️  Task ${id} pausada por user ${userId} — dev_seconds: ${updated[0]?.dev_seconds}s`);

    await record(
      req.user,
      'pausou',
      'tarefa',
      parseInt(id, 10),
      rows[0].title,
      `Motivo: ${reason}`
    );

    const [assigneeRows] = await pool.query(
      'SELECT user_id FROM task_assignees_ti WHERE task_id = ?',
      [id]
    );
    const assigneeIds = assigneeRows.map((r) => r.user_id);
    const actorName = req.user.name || req.user.username || 'Alguém';
    await notifyMultiple(
      assigneeIds,
      'task_paused',
      'Tarefa pausada',
      `A tarefa "${rows[0].title}" foi pausada por ${actorName}. Motivo: ${reason}`,
      '/dashboard',
      userId
    );

    return res.json({ message: 'Timer pausado' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro pausar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const resumeTask = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const conn = await pool.getConnection();

  try {
    const [rows] = await conn.query('SELECT id, status FROM tasks_ti WHERE id = ?', [id]);
    if (rows.length === 0) { conn.release(); return res.status(404).json({ error: 'Tarefa não encontrada' }); }
    if (rows[0].status === 'completed') { conn.release(); return res.status(400).json({ error: 'Tarefa já concluída' }); }

    const [timer] = await conn.query(
      'SELECT dev_seconds, timer_started_at FROM task_user_timers_ti WHERE task_id = ? AND user_id = ?',
      [id, userId]
    );
    if (!timer.length) {
      conn.release();
      return res.status(400).json({ error: 'Você não está atribuído a esta tarefa' });
    }
    if (timer[0].timer_started_at) {
      conn.release();
      return res.status(400).json({ error: 'Seu timer já está ativo nesta tarefa' });
    }

    await conn.beginTransaction();

    // Pausa timers deste user em OUTRAS tarefas
    await pauseAllForUser(conn, userId, parseInt(id));

    // Inicia timer deste user NESTA tarefa
    await conn.query(
      'UPDATE task_user_timers_ti SET timer_started_at = NOW() WHERE task_id = ? AND user_id = ?',
      [id, userId]
    );

    // Tarefa passa a ter pelo menos 1 timer ativo → status = pending
    await conn.query(
      `UPDATE tasks_ti
       SET status = 'pending', pause_reason = NULL, updated_at = NOW()
       WHERE id = ? AND status != 'completed'`,
      [id]
    );

    await conn.commit();
    console.log(`▶️  Task ${id} retomada por user ${userId}`);
    return res.json({ message: 'Timer retomado' });
  } catch (err) {
    await conn.rollback();
    console.error('Erro retomar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const completeTask = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT id, status FROM tasks_ti WHERE id = ?', [id]);
    if (rows.length === 0) { conn.release(); return res.status(404).json({ error: 'Tarefa não encontrada' }); }
    if (rows[0].status === 'completed') { conn.release(); return res.status(400).json({ error: 'Tarefa já está concluída' }); }

    const [assigned] = await conn.query(
      'SELECT 1 FROM task_assignees_ti WHERE task_id = ? AND user_id = ?', [id, userId]
    );
    if (!assigned.length) { conn.release(); return res.status(403).json({ error: 'Apenas pessoas atribuídas podem concluir esta tarefa' }); }

    await conn.beginTransaction();

    // Acumula tempo de TODOS os timers ativos
    await conn.query(
      `UPDATE task_user_timers_ti SET
        dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
        timer_started_at = NULL
      WHERE task_id = ? AND timer_started_at IS NOT NULL`,
      [id]
    );

    // Soma total de todos os timers individuais
    const [sumRow] = await conn.query(
      'SELECT COALESCE(SUM(dev_seconds), 0) AS total FROM task_user_timers_ti WHERE task_id = ?',
      [id]
    );
    const totalSeconds = sumRow[0].total;

    await conn.query(
      `UPDATE tasks_ti SET
        status = 'completed',
        completed_at = NOW(),
        dev_seconds = ?,
        pause_reason = NULL,
        timer_started_at = NULL,
        updated_at = NOW()
      WHERE id = ?`,
      [totalSeconds, id]
    );

    await conn.commit();

    const [updated] = await pool.query(`${taskSelectForUser(userId)} WHERE t.id = ?`, [id]);
    const assigneesMap = await loadAssignees([parseInt(id)]);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const timeStr = h ? `${h}h ${m}min` : `${m}min`;
    await record(req.user, 'concluiu', 'tarefa', parseInt(id), updated[0]?.title, `Tempo de dev: ${timeStr}`);
    return res.json({ ...updated[0], assignees: assigneesMap[parseInt(id)] || [] });
  } catch (err) {
    await conn.rollback();
    console.error('Erro completar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const deleteTask = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT title FROM tasks_ti WHERE id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM tasks_ti WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    await record(req.user, 'apagou', 'tarefa', Number(req.params.id), existing[0]?.title, 'Tarefa removida');
    return res.json({ message: 'Tarefa removida com sucesso' });
  } catch (err) {
    console.error('Erro deletar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM task_categories_ti ORDER BY name');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, username, role
       FROM users
       WHERE active = 1
         AND authorizationStatus = 'approved'
       ORDER BY name`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  getTodayStats,
  getAllTasks,
  createTask,
  updateTask,
  completeTask,
  pauseTask,
  resumeTask,
  deleteTask,
  getCategories,
  getUsers,
};
