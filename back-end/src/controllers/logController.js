const pool = require('../config/database');

const getLogs = async (req, res) => {
  try {
    const { entity, actor_id, limit = 200, offset = 0 } = req.query;
    const isAdmin  = req.user.role === 'admin';
    const isGestor = req.user.role === 'gestor';

    if (!isAdmin && !isGestor) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    let where = 'WHERE 1=1';
    const params = [];

    // Gestor sees only project/task/bonificacao actions; admin sees everything including user/gestor actions
    if (isGestor) {
      where += ` AND l.entity IN ('projeto', 'tarefa', 'bonificacao')`;
    }

    if (entity) {
      where += ' AND l.entity = ?';
      params.push(entity);
    }
    if (actor_id) {
      where += ' AND l.actor_id = ?';
      params.push(actor_id);
    }

    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(
      `SELECT l.*, u.username
       FROM logs_ti l
       LEFT JOIN users u ON u.id = l.actor_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM logs_ti l ${where.replace('LIMIT ? OFFSET ?', '')}`,
      params.slice(0, -2)
    );

    return res.json({ logs: rows, total: countRows[0].total });
  } catch (err) {
    console.error('Erro ao buscar logs:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getLogs };
