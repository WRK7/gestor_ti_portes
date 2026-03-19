const pool = require('../config/database');

const getLogs = async (req, res) => {
  try {
    const { entity, actor_id, date, limit = 200, offset = 0 } = req.query;
    const isSuperAdmin = req.user.role === 'superadmin';
    const isAdmin  = req.user.role === 'admin' || isSuperAdmin;
    const isGestor = req.user.role === 'gestor';

    if (!isAdmin && !isGestor) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    let where = 'WHERE 1=1';
    const params = [];

    // Filtro de data: padrão = hoje (YYYY-MM-DD)
    const dateStr = date || new Date().toISOString().slice(0, 10);
    where += ' AND DATE(l.created_at) = ?';
    params.push(dateStr);

    // superadmin logs ficam ocultos para todos exceto o próprio superadmin
    if (!isSuperAdmin) {
      where += ` AND (l.actor_role IS NULL OR l.actor_role != 'superadmin')`;
    }

    // Gestor: vê os próprios logs e os de qualquer cargo que não seja admin
    if (isGestor) {
      where += ` AND (l.actor_id = ? OR l.actor_role IS NULL OR l.actor_role NOT IN ('admin','superadmin'))`;
      params.push(req.user.id);
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

    const countParams = params.slice(0, -2);
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM logs_ti l ${where}`,
      countParams
    );

    // Contagem por entidade (para as abas) — mesma data e mesmas regras de gestor, sem limit/offset
    let totalByEntity = { tarefa: 0, projeto: 0, bonificacao: 0, usuario: 0 };
    let baseWhere = 'WHERE 1=1 AND DATE(l.created_at) = ?';
    const baseParams = [dateStr];
    if (!isSuperAdmin) {
      baseWhere += ` AND (l.actor_role IS NULL OR l.actor_role != 'superadmin')`;
    }
    if (isGestor) {
      baseWhere += ` AND (l.actor_id = ? OR l.actor_role IS NULL OR l.actor_role NOT IN ('admin','superadmin'))`;
      baseParams.push(req.user.id);
    }
    for (const ent of ['tarefa', 'projeto', 'bonificacao', 'usuario']) {
      const [r] = await pool.query(
        `SELECT COUNT(*) AS c FROM logs_ti l ${baseWhere} AND l.entity = ?`,
        [...baseParams, ent]
      );
      totalByEntity[ent] = r[0].c;
    }

    return res.json({ logs: rows, total: countRows[0].total, totalByEntity });
  } catch (err) {
    console.error('Erro ao buscar logs:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getLogs };
