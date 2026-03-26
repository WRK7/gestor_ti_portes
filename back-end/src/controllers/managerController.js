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
    const managerTimeSql = `
      COALESCE((
        SELECT SUM(
          tut.dev_seconds + GREATEST(COALESCE(TIMESTAMPDIFF(SECOND, tut.timer_started_at, NOW()), 0), 0)
        )
        FROM task_user_timers_ti tut
        WHERE tut.task_id = t.id
      ), 0)
    `;

    // All non-completed tasks with assignees
    const [tasks] = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.pause_reason,
        t.priority,
        t.due_date,
        t.dev_seconds,
        t.timer_started_at,
        ${managerTimeSql} AS current_dev_seconds,
        u.id   AS user_id,
        u.name AS user_name,
        u.username,
        u.role AS user_role,
        tut.timer_started_at IS NOT NULL AS user_timer_active
      FROM tasks_ti t
      LEFT JOIN task_assignees_ti ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      LEFT JOIN task_user_timers_ti tut ON tut.task_id = ta.task_id AND tut.user_id = ta.user_id
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
            pause_reason: row.pause_reason,
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
            t.assignees.push({
              id: row.user_id,
              name: row.user_name,
              username: row.username,
              role: row.user_role,
              timer_active: !!row.user_timer_active,
            });
          }
        }
      }
      return [...map.values()];
    };

    const allTasks = groupTasks(tasks);
    const completedTasks = groupTasks(completed);

    const [projects] = await pool.query(`
      SELECT
        p.id, p.name, p.status, p.awaiting_params, p.bonificado,
        p.suggested_value, p.approved_value, p.hourly_rate, p.difficulty,
        p.dev_seconds, p.bonificado_at, p.updated_at,
        u.id AS resp_id, u.name AS resp_name, u.username AS resp_username,
        gb.name AS approved_by_name
      FROM projects_ti p
      LEFT JOIN users u ON p.responsible_id = u.id
      LEFT JOIN users gb ON p.bonificado_by = gb.id
      ORDER BY
        p.awaiting_params DESC,
        p.bonificado ASC,
        p.updated_at DESC
    `);

    const awaiting = projects.filter(p => p.awaiting_params === 1);
    const pendingBonif = projects.filter(p => !p.awaiting_params && !p.bonificado);
    const bonificado = projects.filter(p => p.bonificado === 1);

    const [programmerSummary] = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.role,
        COALESCE(ts.pending_tasks, 0) AS pending_tasks,
        COALESCE(ts.paused_tasks, 0) AS paused_tasks,
        COALESCE(ts.overdue_tasks, 0) AS overdue_tasks,
        COALESCE(ts.completed_tasks, 0) AS completed_tasks,
        -- "Projetos em andamento" = tarefas ainda não concluídas
        (COALESCE(ts.pending_tasks, 0) + COALESCE(ts.paused_tasks, 0) + COALESCE(ts.overdue_tasks, 0)) AS active_projects,
        -- "Projetos concluídos" = tarefas concluídas
        COALESCE(ts.completed_tasks, 0) AS completed_projects
      FROM users u
      LEFT JOIN (
        SELECT
          ta.user_id,
          COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) AS pending_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'paused' THEN t.id END) AS paused_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'overdue' THEN t.id END) AS overdue_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) AS completed_tasks
        FROM task_assignees_ti ta
        INNER JOIN tasks_ti t ON t.id = ta.task_id
        GROUP BY ta.user_id
      ) ts ON ts.user_id = u.id
      WHERE
        u.active = 1
        AND u.authorizationStatus = 'approved'
        AND (COALESCE(ts.pending_tasks, 0)
          + COALESCE(ts.paused_tasks, 0)
          + COALESCE(ts.overdue_tasks, 0)
          + COALESCE(ts.completed_tasks, 0)) > 0
      ORDER BY u.name ASC
    `);

    return res.json({
      pending:   allTasks.filter(t => t.status === 'pending'),
      paused:    allTasks.filter(t => t.status === 'paused'),
      overdue:   allTasks.filter(t => t.status === 'overdue'),
      completed: completedTasks,
      bonif_awaiting:  awaiting,
      bonif_pending:   pendingBonif,
      bonif_approved:  bonificado,
      programmer_summary: programmerSummary,
    });
  } catch (err) {
    console.error('Erro modo gestor:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getDashboard };
