const pool = require('../config/database');

/**
 * Returns a dashboard for managers:
 *   - pending tasks (active/running), grouped by assignee
 *   - paused tasks, grouped by assignee
 *   - completed tasks (today)
 *   - overdue tasks, with all assignees listed
 */
const getDashboard = async (req, res) => {
  try {
    // All non-completed tasks with assignees
    const [tasks] = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.dev_seconds,
        t.timer_started_at,
        t.dev_seconds + COALESCE(TIMESTAMPDIFF(SECOND, t.timer_started_at, NOW()), 0) AS current_dev_seconds,
        u.id   AS user_id,
        u.name AS user_name,
        u.username,
        u.role AS user_role
      FROM tasks_ti t
      LEFT JOIN task_assignees_ti ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.status IN ('pending', 'paused', 'overdue')
      ORDER BY t.due_date ASC, t.title ASC
    `);

    // All completed tasks
    const [completed] = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.due_date,
        t.dev_seconds,
        t.updated_at,
        u.id   AS user_id,
        u.name AS user_name,
        u.username,
        u.role AS user_role
      FROM tasks_ti t
      LEFT JOIN task_assignees_ti ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.status = 'completed'
      ORDER BY t.updated_at DESC
    `);

    // Build grouped structure: task row per user row -> deduplicate
    const groupTasks = (rows) => {
      const map = new Map();
      for (const row of rows) {
        if (!map.has(row.id)) {
          map.set(row.id, {
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            due_date: row.due_date,
            dev_seconds: row.dev_seconds,
            current_dev_seconds: row.current_dev_seconds,
            updated_at: row.updated_at,
            assignees: [],
          });
        }
        if (row.user_id) {
          const t = map.get(row.id);
          if (!t.assignees.find(a => a.id === row.user_id)) {
            t.assignees.push({ id: row.user_id, name: row.user_name, username: row.username, role: row.user_role });
          }
        }
      }
      return [...map.values()];
    };

    const allTasks = groupTasks(tasks);
    const completedTasks = groupTasks(completed);

    return res.json({
      pending:   allTasks.filter(t => t.status === 'pending'),
      paused:    allTasks.filter(t => t.status === 'paused'),
      overdue:   allTasks.filter(t => t.status === 'overdue'),
      completed: completedTasks,
    });
  } catch (err) {
    console.error('Erro modo gestor:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getDashboard };
