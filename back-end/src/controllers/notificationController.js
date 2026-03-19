const pool = require('../config/database');

let _managerIdsCache = null;
let _managerIdsCacheTime = 0;
const CACHE_TTL = 60_000;

const getManagerIds = async () => {
  const now = Date.now();
  if (_managerIdsCache && now - _managerIdsCacheTime < CACHE_TTL) return _managerIdsCache;
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE role IN ('gestor','admin','superadmin') AND active = 1"
  );
  _managerIdsCache = rows.map(r => r.id);
  _managerIdsCacheTime = now;
  return _managerIdsCache;
};

const getMyNotifications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications_ti WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar notificações:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications_ti WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    const c = rows[0].count;
    return res.json({ count: Number(c) });
  } catch (err) {
    console.error('Erro ao contar notificações:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const markAsRead = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE notifications_ti SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar como lida:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications_ti SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar todas como lidas:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const notify = async (userId, type, title, message, link = null) => {
  try {
    await pool.query(
      `INSERT INTO notifications_ti (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, message, link]
    );
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
};

const notifyMultiple = async (userIds, type, title, message, link = null) => {
  if (!userIds?.length) return;

  const managerIds = await getManagerIds();
  const allIds = [...new Set([...userIds, ...managerIds])];

  for (const uid of allIds) {
    await notify(uid, type, title, message, link);
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notify,
  notifyMultiple,
};
