import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ROLES = ['admin', 'dev', 'suporte', 'gestor'];

const roleColors = {
  admin:   { color: '#7c3aed', bg: '#f5f3ff' },
  dev:     { color: '#2563eb', bg: '#eff6ff' },
  suporte: { color: '#0891b2', bg: '#ecfeff' },
  gestor:  { color: '#d97706', bg: '#fffbeb' },
};

function RoleBadge({ role }) {
  const cfg = roleColors[role] || { color: '#6b7280', bg: '#f9fafb' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}25`,
      textTransform: 'capitalize',
    }}>
      {role}
    </span>
  );
}

function UserModal({ user, onClose, onSave, currentUserRole }) {
  const isEdit = !!user;
  const canEditPassword = currentUserRole === 'admin' || !isEdit;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username:  user?.username || '',
    name:      user?.name || '',
    email:     user?.email || '',
    role:      user?.role || 'dev',
    password:  '',
  });

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) { setError('Usuário é obrigatório'); return; }
    if (!isEdit && !form.password.trim()) { setError('Senha é obrigatória para novo usuário'); return; }
    setError('');
    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(),
        name:     form.name.trim() || form.username.trim(),
        email:    form.email.trim() || null,
        role:     form.role,
        ...(form.password.trim() ? { password: form.password } : {}),
      };
      if (isEdit) await api.put(`/users/${user.id}`, payload);
      else        await api.post('/users', payload);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Campos ocultos para enganar o autocomplete do browser */}
          <input type="text" name="fake-user" style={{ display: 'none' }} readOnly />
          <input type="password" name="fake-pass" style={{ display: 'none' }} readOnly />

          <div className="modal-body">
            {error && (
              <div className="modal-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="modal-row">
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Nome completo</label>
                <input className="input" type="text" placeholder="Ex.: João Silva"
                  value={form.name} onChange={set('name')} autoFocus
                  autoComplete="off" name="new-name" />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Usuário *</label>
                <input className="input" type="text" placeholder="Ex.: joaosilva"
                  value={form.username} onChange={set('username')} disabled={isEdit}
                  autoComplete="off" name="new-username" />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">E-mail</label>
              <input className="input" type="text" placeholder="Ex.: joao@empresa.com"
                value={form.email} onChange={set('email')}
                autoComplete="off" name="new-email" />
            </div>

            <div className="modal-row">
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Cargo</label>
                <select className="input" value={form.role} onChange={set('role')}>
                  {ROLES.map(r => (
                    <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>
                  ))}
                </select>
              </div>
              {canEditPassword ? (
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">{isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</label>
                  <input className="input" type="password" placeholder={isEdit ? '••••••••' : 'Senha'}
                    value={form.password} onChange={set('password')}
                    autoComplete="new-password" name="new-password" />
                </div>
              ) : (
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Senha</label>
                  <div style={{ padding: '9px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, color: 'var(--gray-400)' }}>
                    Alteração de senha disponível apenas para admins
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <><div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />Salvando...</>
              ) : isEdit ? 'Salvar Alterações' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .modal-error { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; color: #dc2626; font-size: 13px; margin-bottom: 16px; }
        .modal-row { display: flex; gap: 12px; }
        .modal-row .input-group { margin-bottom: 16px; }
      `}</style>
    </div>
  );
}

export default function Usuarios() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const isGestor = currentUser?.role === 'gestor';
  const isAdmin = currentUser?.role === 'admin';
  const canEditUser = (targetUser) => {
    if (isAdmin) return true;
    if (isGestor && targetUser?.role === 'admin') return false;
    return true;
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleActive = async (user) => {
    try {
      await api.patch(`/users/${user.id}/toggle-active`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Remover o usuário "${user.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover usuário');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/configuracoes')} title="Voltar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="dashboard-title">Usuários</h1>
            <p className="dashboard-date">Gerenciamento de contas e permissões</p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
            </svg>
            Atualizar
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, maxWidth: 360, position: 'relative' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input"
          type="text"
          placeholder="Buscar por nome, usuário ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Table */}
      <div className="users-table-wrap">
        {loading ? (
          <div className="tasks-loading">
            <div className="spinner" /><span>Carregando usuários...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <p>Nenhum usuário encontrado</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Cargo</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar-sm">
                        {(u.name || u.username).split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--gray-900)', fontSize: 13 }}>{u.name || u.username}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.username}</td>
                  <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.email || '—'}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>
                    {canEditUser(u) ? (
                      <button
                        className={`status-toggle ${u.active ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleActive(u)}
                        title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        <span className="status-toggle-dot" />
                        {u.active ? 'Ativo' : 'Inativo'}
                      </button>
                    ) : (
                      <span className={`status-toggle status-readonly ${u.active ? 'active' : 'inactive'}`} title="Somente leitura">
                        <span className="status-toggle-dot" />
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {canEditUser(u) ? (
                        <>
                          <button className="task-action-btn" title="Editar" onClick={() => { setEditing(u); setModalOpen(true); }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button className="task-action-btn red" title="Remover" onClick={() => handleDelete(u)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>restrito</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <UserModal
          user={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={() => { setModalOpen(false); setEditing(null); fetchUsers(); }}
          currentUserRole={currentUser?.role}
        />
      )}

      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; }

        .users-table-wrap {
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .users-table {
          width: 100%;
          border-collapse: collapse;
        }
        .users-table th {
          padding: 10px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: var(--gray-400);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          background: var(--gray-50);
          border-bottom: 1px solid var(--gray-200);
        }
        .users-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--gray-100);
          vertical-align: middle;
        }
        .users-table tbody tr:last-child td { border-bottom: none; }
        .users-table tbody tr:hover td { background: var(--gray-50); }

        .user-avatar-sm {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: var(--gray-200);
          color: var(--gray-600);
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .status-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px 3px 6px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--transition);
          background: none;
        }
        .status-toggle.active { color: #16a34a; background: #f0fdf4; border-color: #bbf7d0; }
        .status-toggle.inactive { color: #6b7280; background: var(--gray-100); border-color: var(--gray-200); }
        .status-toggle:hover { filter: brightness(0.93); }
        .status-toggle.status-readonly { cursor: default; pointer-events: none; }
        .status-toggle.status-readonly:hover { filter: none; }
        .status-toggle-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: currentColor;
        }

        .task-action-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--gray-500); transition: all var(--transition); }
        .task-action-btn:hover { background: var(--gray-100); color: var(--gray-700); border-color: var(--gray-300); }
        .task-action-btn.red:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        .tasks-loading { display: flex; align-items: center; gap: 10px; padding: 40px 20px; color: var(--gray-400); font-size: 14px; }
      `}</style>
    </div>
  );
}
