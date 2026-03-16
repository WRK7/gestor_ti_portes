const pool = require('../config/database');
const { record } = require('../utils/log');

const toMysqlDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const loadAssignees = async (taskIds) => {
  if (!taskIds.length) return {};
  const [rows] = await pool.query(
    `SELECT ta.task_id, u.id, u.name, u.username
     FROM task_assignees_ti ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id IN (?)`,
    [taskIds]
  );
  return rows.reduce((map, row) => {
    if (!map[row.task_id]) map[row.task_id] = [];
    map[row.task_id].push({ id: row.id, name: row.name, username: row.username });
    return map;
  }, {});
};

const setAssignees = async (conn, taskId, assigneeIds) => {
  await conn.query('DELETE FROM task_assignees_ti WHERE task_id = ?', [taskId]);
  if (assigneeIds && assigneeIds.length > 0) {
    const values = assigneeIds.map(uid => [taskId, uid]);
    await conn.query('INSERT INTO task_assignees_ti (task_id, user_id) VALUES ?', [values]);
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
  await pool.query(`
    UPDATE tasks_ti
    SET status = 'overdue', updated_at = NOW()
    WHERE status IN ('pending', 'paused') AND due_date < NOW()
  `);
};

// Pausa todas as tasks pending (exceto excludeTaskId), acumulando tempo via MySQL
const pauseAllPending = async (conn, excludeTaskId) => {
  await conn.query(
    `UPDATE tasks_ti
     SET status = 'paused',
         dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
         timer_started_at = NULL,
         updated_at = NOW()
     WHERE status = 'pending' AND id != ?`,
    [excludeTaskId]
  );
};

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

const TASK_SELECT = `
  SELECT
    t.id, t.title, t.description, t.status, t.priority,
    t.due_date, t.completed_at, t.dev_seconds, t.timer_started_at,
    t.created_at, t.updated_at,
    CASE
      WHEN t.timer_started_at IS NOT NULL
      THEN t.dev_seconds + TIMESTAMPDIFF(SECOND, t.timer_started_at, NOW())
      ELSE t.dev_seconds
    END AS current_dev_seconds,
    c.id AS category_id, c.name AS category_name, c.color AS category_color
  FROM tasks_ti t
  LEFT JOIN task_categories_ti c ON t.category_id = c.id`;

const getAllTasks = async (req, res) => {
  try {
    await updateOverdueTasks();
    const { date, status } = req.query;
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

    const [tasks] = await pool.query(
      `${TASK_SELECT}
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

  if (new Date(due_date) <= new Date()) {
    return res.status(400).json({ error: 'A data de vencimento deve ser no futuro' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO tasks_ti (title, description, due_date, priority, category_id, created_by, timer_started_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, description || null, toMysqlDate(due_date), priority || 'medium', category_id || null, req.user.id]
    );
    const taskId = result.insertId;

    await pauseAllPending(conn, taskId);

    const ids = normalizeAssignees(assignees);
    await setAssignees(conn, taskId, ids);

    await conn.commit();

    const [tasks] = await pool.query(`${TASK_SELECT} WHERE t.id = ?`, [taskId]);
    const assigneesMap = await loadAssignees([taskId]);
    await record(req.user, 'criou', 'tarefa', taskId, title);
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
        status      = COALESCE(?, status),
        category_id = COALESCE(?, category_id),
        completed_at = ${completedAtExpr},
        updated_at  = NOW()
      WHERE id = ?`,
      [title, description, toMysqlDate(due_date), priority, status, category_id, id]
    );

    if (assignees !== undefined) {
      await setAssignees(conn, id, normalizeAssignees(assignees));
    }

    await conn.commit();

    const [tasks] = await pool.query(`${TASK_SELECT} WHERE t.id = ?`, [id]);
    const assigneesMap = await loadAssignees([parseInt(id)]);
    await record(req.user, 'editou', 'tarefa', parseInt(id), tasks[0]?.title || title);
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
  try {
    const [rows] = await pool.query(
      'SELECT id, status FROM tasks_ti WHERE id = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Apenas tarefas pendentes podem ser pausadas' });
    }

    // Acumula tempo inteiramente no MySQL — zero chance de timezone mismatch
    await pool.query(
      `UPDATE tasks_ti SET
        status = 'paused',
        dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
        timer_started_at = NULL,
        updated_at = NOW()
      WHERE id = ?`,
      [id]
    );

    const [updated] = await pool.query('SELECT dev_seconds FROM tasks_ti WHERE id = ?', [id]);
    console.log(`⏸️  Task ${id} pausada — dev_seconds salvo: ${updated[0].dev_seconds}s`);

    return res.json({ message: 'Tarefa pausada', dev_seconds: updated[0].dev_seconds });
  } catch (err) {
    console.error('Erro pausar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const resumeTask = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT id, status, dev_seconds FROM tasks_ti WHERE id = ?', [id]
    );
    if (rows.length === 0) { conn.release(); return res.status(404).json({ error: 'Tarefa não encontrada' }); }
    if (rows[0].status !== 'paused') { conn.release(); return res.status(400).json({ error: 'Apenas tarefas pausadas podem ser retomadas' }); }

    console.log(`▶️  Task ${id} retomando — dev_seconds atual: ${rows[0].dev_seconds}s`);

    await conn.beginTransaction();

    await pauseAllPending(conn, parseInt(id));

    await conn.query(
      `UPDATE tasks_ti SET status = 'pending', timer_started_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [id]
    );

    await conn.commit();
    return res.json({ message: 'Tarefa retomada' });
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
  try {
    const [rows] = await pool.query(
      'SELECT id, status FROM tasks_ti WHERE id = ?', [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    if (rows[0].status === 'completed') {
      return res.status(400).json({ error: 'Tarefa já está concluída' });
    }

    // Acumula tempo final no MySQL
    await pool.query(
      `UPDATE tasks_ti SET
        status = 'completed',
        completed_at = NOW(),
        dev_seconds = dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, timer_started_at, NOW()), 0),
        timer_started_at = NULL,
        updated_at = NOW()
      WHERE id = ?`,
      [id]
    );

    const [updated] = await pool.query(`${TASK_SELECT} WHERE t.id = ?`, [id]);
    const assigneesMap = await loadAssignees([parseInt(id)]);
    await record(req.user, 'concluiu', 'tarefa', parseInt(id), updated[0]?.title);
    return res.json({ ...updated[0], assignees: assigneesMap[parseInt(id)] || [] });
  } catch (err) {
    console.error('Erro completar tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteTask = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT title FROM tasks_ti WHERE id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM tasks_ti WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    await record(req.user, 'apagou', 'tarefa', Number(req.params.id), existing[0]?.title);
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
