const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, username, password, name, role, active, authorizationStatus
       FROM users
       WHERE username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];

    if (!user.active) {
      return res.status(403).json({ error: 'Conta desativada. Contate o administrador.' });
    }

    if (user.authorizationStatus && user.authorizationStatus !== 'approved') {
      return res.status(403).json({ error: 'Conta pendente de aprovação.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor', detail: err.message });
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, name, role, active, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { login, me };
