const pool  = require('../config/database');
const { record } = require('../utils/log');

const projectSelect = `
  SELECT
    p.*,
    u.name  AS responsible_name,
    u.id    AS responsible_id,
    cb.name AS created_by_name
  FROM projects_ti p
  LEFT JOIN users u  ON p.responsible_id = u.id
  LEFT JOIN users cb ON p.created_by      = cb.id`;

const getAllProjects = async (req, res) => {
  try {
    const { bonificado, awaiting_params, month, year } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (bonificado !== undefined) {
      where += ' AND p.bonificado = ?';
      params.push(bonificado === '1' || bonificado === 'true' ? 1 : 0);
    }

    if (awaiting_params !== undefined) {
      where += ' AND p.awaiting_params = ?';
      params.push(awaiting_params === '1' || awaiting_params === 'true' ? 1 : 0);
    }

    // month/year filter: show projects bonified in that month OR not yet bonified
    if (month && year) {
      where += ` AND (
        p.bonificado = 0
        OR (MONTH(p.bonificado_at) = ? AND YEAR(p.bonificado_at) = ?)
      )`;
      params.push(Number(month), Number(year));
    }

    const [rows] = await pool.query(
      `${projectSelect}
      ${where}
      ORDER BY
        p.awaiting_params DESC,
        p.bonificado ASC,
        p.updated_at DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar projetos:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getProjectById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${projectSelect} WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createProject = async (req, res) => {
  const {
    name, description, status, link,
    progress, dev_seconds, financial_return,
    suggested_value, responsible_id,
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Nome do projeto é obrigatório' });

  try {
    const [result] = await pool.query(
      `INSERT INTO projects_ti
        (name, description, status, link, progress, dev_seconds,
         financial_return, suggested_value, responsible_id, created_by, awaiting_params)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        name,
        description || null,
        status || 'completed',
        link || null,
        progress ?? 100,
        dev_seconds || 0,
        financial_return || null,
        suggested_value || null,
        responsible_id || null,
        req.user.id,
      ]
    );

    const [rows] = await pool.query(`${projectSelect} WHERE p.id = ?`, [result.insertId]);
    await record(req.user, 'criou', 'projeto', result.insertId, name);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createFromTask = async (req, res) => {
  const { taskId } = req.params;

  try {
    const [tasks] = await pool.query(
      `SELECT t.*, c.name AS category_name FROM tasks_ti t
       LEFT JOIN task_categories_ti c ON t.category_id = c.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (tasks.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const task = tasks[0];
    if (task.status !== 'completed') {
      return res.status(400).json({ error: 'Apenas tarefas concluídas podem ser enviadas para bonificação' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM projects_ti WHERE source_task_id = ?', [taskId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Esta tarefa já possui um projeto de bonificação vinculado' });
    }

    const [assignees] = await pool.query(
      'SELECT user_id FROM task_assignees_ti WHERE task_id = ? LIMIT 1', [taskId]
    );
    const responsibleId = assignees.length > 0 ? assignees[0].user_id : null;

    const [result] = await pool.query(
      `INSERT INTO projects_ti
        (name, description, status, progress, dev_seconds, source_task_id,
         responsible_id, created_by, awaiting_params, bonificado)
       VALUES (?, ?, 'completed', 100, ?, ?, ?, ?, 1, 0)`,
      [task.title, task.description || null, task.dev_seconds || 0, taskId, responsibleId, req.user.id]
    );

    const [rows] = await pool.query(`${projectSelect} WHERE p.id = ?`, [result.insertId]);
    await record(req.user, 'enviou para bonificação', 'projeto', result.insertId, task.title);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar projeto a partir da tarefa:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    name, description, status, link,
    progress, dev_seconds, financial_return,
    suggested_value, responsible_id,
  } = req.body;

  try {
    const [existing] = await pool.query('SELECT id, name, awaiting_params FROM projects_ti WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });

    const hasParams = link || financial_return || suggested_value;
    const newAwaitingParams = hasParams ? 0 : existing[0].awaiting_params;

    await pool.query(
      `UPDATE projects_ti SET
        name             = COALESCE(?, name),
        description      = COALESCE(?, description),
        status           = COALESCE(?, status),
        link             = COALESCE(?, link),
        progress         = COALESCE(?, progress),
        dev_seconds      = COALESCE(?, dev_seconds),
        financial_return = COALESCE(?, financial_return),
        suggested_value  = COALESCE(?, suggested_value),
        responsible_id   = COALESCE(?, responsible_id),
        awaiting_params  = ?,
        updated_at       = NOW()
      WHERE id = ?`,
      [name, description, status, link, progress, dev_seconds,
       financial_return, suggested_value, responsible_id, newAwaitingParams, id]
    );

    const [rows] = await pool.query(`${projectSelect} WHERE p.id = ?`, [id]);
    const projectName = rows[0]?.name || existing[0].name;
    await record(req.user, 'editou', 'projeto', Number(id), projectName);
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar projeto:', err.message || err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteProject = async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT name FROM projects_ti WHERE id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM projects_ti WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
    await record(req.user, 'apagou', 'projeto', Number(req.params.id), existing[0]?.name);
    return res.json({ message: 'Projeto removido com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar projeto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const toggleBonificado = async (req, res) => {
  const { id } = req.params;
  const { approved_value } = req.body; // optional override value from gestor

  if (req.user.role !== 'gestor') {
    return res.status(403).json({ error: 'Apenas o gestor pode aprovar bonificações' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, name, bonificado, awaiting_params, suggested_value FROM projects_ti WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });

    if (existing[0].awaiting_params) {
      return res.status(400).json({ error: 'Preencha os parâmetros do projeto antes de bonificar' });
    }

    const newVal = existing[0].bonificado ? 0 : 1;
    const finalValue = newVal
      ? (approved_value != null ? Number(approved_value) : existing[0].suggested_value)
      : null;

    await pool.query(
      `UPDATE projects_ti SET
        bonificado      = ?,
        approved_value  = ?,
        bonificado_at   = ${newVal ? 'NOW()' : 'NULL'},
        bonificado_by   = ${newVal ? '?' : 'NULL'},
        updated_at      = NOW()
      WHERE id = ?`,
      newVal ? [newVal, finalValue, req.user.id, id] : [newVal, null, id]
    );

    const action = newVal ? 'aprovou bonificação' : 'reverteu bonificação';
    const detail = newVal && finalValue != null ? `Valor aprovado: R$ ${finalValue}` : null;
    await record(req.user, action, 'bonificacao', Number(id), existing[0].name, detail);

    const [rows] = await pool.query(`${projectSelect} WHERE p.id = ?`, [id]);
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar bonificação:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getStats = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        COUNT(*)                                                  AS total,
        COALESCE(SUM(awaiting_params = 1), 0)                    AS awaiting,
        COALESCE(SUM(awaiting_params = 0 AND bonificado = 0), 0) AS pending,
        COALESCE(SUM(bonificado = 1), 0)                         AS bonificado
      FROM projects_ti`
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar stats projetos:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Returns monthly breakdown: list of {year, month, total_projects, total_approved}
const getMonthlyStats = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        YEAR(bonificado_at)  AS year,
        MONTH(bonificado_at) AS month,
        COUNT(*)             AS total_projects,
        SUM(COALESCE(approved_value, suggested_value, 0)) AS total_approved
      FROM projects_ti
      WHERE bonificado = 1 AND bonificado_at IS NOT NULL
      GROUP BY YEAR(bonificado_at), MONTH(bonificado_at)
      ORDER BY year DESC, month DESC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar stats mensais:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Returns per-user bonification totals for a given month/year
const getMonthlyByUser = async (req, res) => {
  const { month, year } = req.query;
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.username,
        u.role,
        COUNT(p.id)  AS total_projects,
        SUM(COALESCE(p.approved_value, p.suggested_value, 0)) AS total_value,
        JSON_ARRAYAGG(JSON_OBJECT(
          'id', p.id,
          'name', p.name,
          'approved_value', p.approved_value,
          'suggested_value', p.suggested_value,
          'bonificado_at', p.bonificado_at
        )) AS projects
      FROM projects_ti p
      JOIN users u ON u.id = p.responsible_id
      WHERE p.bonificado = 1
        AND p.bonificado_at IS NOT NULL
        AND MONTH(p.bonificado_at) = ?
        AND YEAR(p.bonificado_at)  = ?
      GROUP BY u.id, u.name, u.username, u.role
      ORDER BY total_value DESC
    `, [Number(month), Number(year)]);
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar bonificações por usuário:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Projects pending bonification (all time) — for calendar/dashboard view
const getPendingByUser = async (req, res) => {
  const { user_id } = req.query;
  try {
    let where = `WHERE p.bonificado = 0 AND p.awaiting_params = 0`;
    const params = [];
    if (user_id) { where += ` AND p.responsible_id = ?`; params.push(user_id); }

    const [rows] = await pool.query(
      `SELECT p.*, u.name AS responsible_name, u.role AS responsible_role
       FROM projects_ti p
       LEFT JOIN users u ON u.id = p.responsible_id
       ${where}
       ORDER BY p.updated_at DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar projetos pendentes:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  createFromTask,
  updateProject,
  deleteProject,
  getStats,
  getMonthlyStats,
  getMonthlyByUser,
  getPendingByUser,
  toggleBonificado,
};
