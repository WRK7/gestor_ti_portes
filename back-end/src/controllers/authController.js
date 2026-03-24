const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME || 'refresh_token';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

const hashRefresh = (raw) => crypto.createHash('sha256').update(raw, 'utf8').digest('hex');

const cookieOpts = () => {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  return { httpOnly: true, secure, sameSite, path: '/api/auth' };
};

const setRefreshCookie = (res, rawToken) => {
  const maxAge = REFRESH_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, rawToken, {
    ...cookieOpts(),
    maxAge,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, cookieOpts());
};

const signAccessToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );

const issueRefreshToken = async (conn, userId) => {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefresh(raw);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await conn.query(
    `INSERT INTO refresh_tokens_ti (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    [userId, tokenHash, expiresAt]
  );
  return raw;
};

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT id, username, password, name, role, active, authorizationStatus
       FROM users
       WHERE LOWER(username) = LOWER(?)`,
      [String(username).trim()]
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

    await conn.beginTransaction();

    if (process.env.REVOKE_REFRESH_ON_LOGIN === 'true') {
      await conn.query('DELETE FROM refresh_tokens_ti WHERE user_id = ?', [user.id]);
    }

    const refreshRaw = await issueRefreshToken(conn, user.id);
    await conn.commit();

    setRefreshCookie(res, refreshRaw);

    const payload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);

    return res.json({
      accessToken,
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
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

const refresh = async (req, res) => {
  const raw = req.cookies[REFRESH_COOKIE];
  if (!raw) {
    return res.status(401).json({ error: 'Sessão não encontrada' });
  }

  const tokenHash = hashRefresh(raw);
  const conn = await pool.getConnection();

  try {
    const [rows] = await conn.query(
      `SELECT rt.id, rt.user_id, u.username, u.name, u.role, u.active, u.authorizationStatus
       FROM refresh_tokens_ti rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (rows.length === 0) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }

    const row = rows[0];
    if (!row.active) {
      await conn.query('DELETE FROM refresh_tokens_ti WHERE user_id = ?', [row.user_id]);
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Conta desativada.' });
    }
    if (row.authorizationStatus && row.authorizationStatus !== 'approved') {
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Conta pendente de aprovação.' });
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM refresh_tokens_ti WHERE id = ?', [row.id]);
    const newRaw = await issueRefreshToken(conn, row.user_id);
    await conn.commit();

    setRefreshCookie(res, newRaw);

    const payload = {
      id: row.user_id,
      username: row.username,
      name: row.name,
      role: row.role,
    };
    const accessToken = signAccessToken(payload);

    return res.json({
      accessToken,
      token: accessToken,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    console.error('Erro no refresh:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    conn.release();
  }
};

const logout = async (req, res) => {
  const raw = req.cookies[REFRESH_COOKIE];
  if (raw) {
    const tokenHash = hashRefresh(raw);
    try {
      await pool.query('DELETE FROM refresh_tokens_ti WHERE token_hash = ?', [tokenHash]);
    } catch (err) {
      console.error('Erro ao revogar refresh:', err.message);
    }
  }
  clearRefreshCookie(res);
  return res.json({ success: true });
};

module.exports = { login, me, refresh, logout };
