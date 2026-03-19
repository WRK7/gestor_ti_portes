const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { record } = require('../utils/log');

const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email, name, role, active, created_at, updated_at
       FROM users
       ORDER BY name`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const createUser = async (req, res) => {
  const { username, name, email, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, name, email, password, role, active, authorizationStatus)
       VALUES (?, ?, ?, ?, ?, 1, 'approved')`,
      [username, name || username, email || null, hashed, role || 'dev']
    );
    const [rows] = await pool.query(
      'SELECT id, username, email, name, role, active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    const parts = [];
    if (name && name !== username) parts.push(`Nome: ${name}`);
    if (email) parts.push(`E-mail: ${email}`);
    parts.push(`Cargo: ${role || 'dev'}`);
    await record(req.user, 'criou', 'usuario', result.insertId, username, parts.join(' · '));
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Usuário ou e-mail já cadastrado' });
    }
    console.error('Erro ao criar usuário:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, active, password } = req.body;
  const actorRole = req.user.role;

  try {
    const [existing] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const targetRole = existing[0].role;
    const isSelf = Number(id) === req.user.id;

    // Roles sem permissão de gestão só podem editar a si mesmos (nome, email, senha)
    if (!['superadmin', 'admin', 'gestor'].includes(actorRole) && !isSelf) {
      return res.status(403).json({ error: 'Você só pode editar suas próprias informações' });
    }

    // Hierarquia: superadmin > admin > gestor > demais
    // Ninguém pode promover/rebaixar para um cargo acima do próprio
    if (targetRole === 'superadmin' && actorRole !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas superadmins podem modificar contas de superadmin' });
    }
    if (targetRole === 'admin' && !['superadmin'].includes(actorRole)) {
      return res.status(403).json({ error: 'Apenas superadmins podem modificar contas de admin' });
    }
    if (actorRole === 'gestor' && ['admin', 'superadmin'].includes(targetRole)) {
      return res.status(403).json({ error: 'Gestores não podem modificar contas superiores' });
    }
    // Só admin+ pode alterar cargo; ninguém muda o próprio cargo (exceto superadmin)
    if (role && role !== targetRole) {
      if (!['admin', 'superadmin'].includes(actorRole)) {
        return res.status(403).json({ error: 'Apenas admins podem alterar cargos' });
      }
      if (actorRole === 'admin' && ['superadmin'].includes(role)) {
        return res.status(403).json({ error: 'Admins não podem promover a superadmin' });
      }
      if (isSelf && actorRole !== 'superadmin') {
        return res.status(403).json({ error: 'Você não pode alterar o próprio cargo' });
      }
    }
    // Só admin+ pode alterar senhas de outros
    if (!['admin', 'superadmin'].includes(actorRole) && !isSelf && password && password.trim()) {
      return res.status(403).json({ error: 'Apenas admins podem alterar senhas de outros usuários' });
    }

    let passwordClause = '';
    const params = [];

    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password, 10);
      passwordClause = ', password = ?';
      params.push(hashed);
    }

    await pool.query(
      `UPDATE users SET
        name   = COALESCE(?, name),
        email  = COALESCE(?, email),
        role   = COALESCE(?, role),
        active = COALESCE(?, active)
        ${passwordClause},
        updated_at = NOW()
      WHERE id = ?`,
      [name || null, email || null, role || null, active ?? null, ...params, id]
    );

    const [rows] = await pool.query(
      'SELECT id, username, email, name, role, active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    const detailParts = [];
    if (name != null) detailParts.push('nome');
    if (email != null) detailParts.push('e-mail');
    if (role != null) detailParts.push('cargo');
    if (active != null) detailParts.push('status');
    if (password && password.trim()) detailParts.push('senha');
    await record(req.user, 'editou', 'usuario', Number(id), rows[0]?.username, detailParts.length ? `Alterado: ${detailParts.join(', ')}` : 'Dados atualizados');
    return res.json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'E-mail já cadastrado' });
    }
    console.error('Erro ao atualizar usuário:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Você não pode remover a sua própria conta' });
  }
  try {
    const [target] = await pool.query('SELECT username, role FROM users WHERE id = ?', [id]);
    if (target[0]?.role === 'superadmin') {
      return res.status(403).json({ error: 'Contas de superadmin não podem ser removidas' });
    }
    if (target[0]?.role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas superadmins podem remover contas de admin' });
    }
    if (['admin', 'superadmin'].includes(target[0]?.role) && req.user.role === 'gestor') {
      return res.status(403).json({ error: 'Gestores não podem remover contas superiores' });
    }
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    await record(req.user, 'apagou', 'usuario', Number(id), target[0]?.username, target[0]?.role ? `Cargo: ${target[0].role}` : null);
    return res.json({ message: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar usuário:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const toggleActive = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Você não pode desativar a sua própria conta' });
  }
  try {
    const [existing] = await pool.query('SELECT id, active, role FROM users WHERE id = ?', [id]);
    if (existing[0]?.role === 'superadmin') {
      return res.status(403).json({ error: 'Contas de superadmin não podem ser desativadas' });
    }
    if (existing[0]?.role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas superadmins podem alterar status de contas de admin' });
    }
    if (['admin', 'superadmin'].includes(existing[0]?.role) && req.user.role === 'gestor') {
      return res.status(403).json({ error: 'Gestores não podem alterar status de contas superiores' });
    }
    if (existing.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const newActive = existing[0].active ? 0 : 1;
    await pool.query('UPDATE users SET active = ?, updated_at = NOW() WHERE id = ?', [newActive, id]);

    const [rows] = await pool.query(
      'SELECT id, username, email, name, role, active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    await record(req.user, newActive ? 'ativou' : 'desativou', 'usuario', Number(id), rows[0]?.username, newActive ? 'Conta ativada' : 'Conta desativada');
    return res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao alternar ativo:', err.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, toggleActive };
