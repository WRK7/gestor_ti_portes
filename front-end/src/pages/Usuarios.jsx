import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';

const ROLES = ['superadmin', 'admin', 'gestor', 'dev', 'suporte', 'rh'];

const roleColors = {
  superadmin: { color: '#dc2626', bg: 'var(--red-50)' },
  admin:      { color: '#7c3aed', bg: 'var(--purple-50)' },
  dev:        { color: '#2563eb', bg: 'var(--blue-50)'   },
  suporte:    { color: '#0891b2', bg: 'var(--cyan-50)'   },
  gestor:     { color: '#d97706', bg: 'var(--amber-50)'  },
  rh:         { color: '#ec4899', bg: '#fdf2f8'          },
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

function UserModal({ user, onClose, onSave, currentUserRole, currentUserId }) {
  const isEdit = !!user;
  const isSelf = user && Number(user.id) === Number(currentUserId);
  const isRhSelfEdit = currentUserRole === 'rh' && isEdit && isSelf;
  const canEditPassword = ['admin', 'superadmin'].includes(currentUserRole) || !isEdit || isSelf;
  const availableRoles = currentUserRole === 'superadmin'
    ? ROLES
    : currentUserRole === 'admin'
      ? ROLES.filter(r => r !== 'superadmin')
      : ROLES;
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
    if (form.password.trim() && form.password.trim().length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(),
        name:     form.name.trim() || form.username.trim(),
        email:    form.email.trim() || null,
        ...(!isRhSelfEdit ? { role: form.role } : {}),
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

            <div className="modal-row modal-row-inputs-align">
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Cargo</label>
                {isRhSelfEdit ? (
                  <>
                    <input className="input" value={form.role} readOnly disabled style={{ textTransform: 'capitalize', cursor: 'not-allowed' }} />
                    <span className="input-label-hint">Apenas admin pode alterar cargos.</span>
                  </>
                ) : (
                <select className="input" value={form.role} onChange={set('role')}>
                  {availableRoles.map(r => (
                    <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r}</option>
                  ))}
                </select>
                )}
              </div>
              {canEditPassword ? (
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">{isEdit ? 'Nova senha' : 'Senha *'}</label>
                  {isEdit && (
                    <span className="input-label-hint">Deixe em branco para manter a senha atual. Se preencher, mínimo 6 caracteres.</span>
                  )}
                  {!isEdit && (
                    <span className="input-label-hint">Mínimo 6 caracteres.</span>
                  )}
                  <input className="input" type="password" placeholder={isEdit ? '••••••••' : 'Senha'}
                    value={form.password} onChange={set('password')}
                    autoComplete="new-password" name="new-password" />
                </div>
              ) : (
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Senha</label>
                  <div style={{ padding: '9px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, color: 'var(--gray-400)' }}>
                    Alteração de senha disponível apenas para admins/superadmins
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
        .modal-error { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--red-50); border: 1px solid var(--red-100); border-radius: 8px; color: var(--red-600); font-size: 13px; margin-bottom: 16px; }
        .modal-row { display: flex; gap: 12px; }
        .modal-row .input-group { margin-bottom: 16px; }
        .modal-row-inputs-align { align-items: flex-end; }
        .modal-row-inputs-align .input-group { display: flex; flex-direction: column; }
        .input-label-hint {
          display: block;
          font-size: 11px;
          font-weight: 400;
          color: var(--gray-400);
          line-height: 1.3;
          margin: -6px 0 6px;
        }
      `}</style>
    </div>
  );
}

export default function Usuarios() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { confirm, alert } = useDialog();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isGestor = currentUser?.role === 'gestor';
  const isRH = currentUser?.role === 'rh';

  /** Abrir modal de edição (RH: só o próprio registro) */
  const canEditUser = (targetUser) => {
    if (isRH) return Number(targetUser?.id) === Number(currentUser?.id);
    if (isSuperAdmin) return true;
    if (currentUser?.role === 'admin' && targetUser?.role === 'superadmin') return false;
    if (currentUser?.role === 'admin') return true;
    if (isGestor && ['admin', 'superadmin'].includes(targetUser?.role)) return false;
    return true;
  };

  /** Ativar/desativar ou excluir — RH não usa essas ações na lista */
  const canManageUserLifecycle = (targetUser) => {
    if (isRH) return false;
    if (isSuperAdmin) return true;
    if (currentUser?.role === 'admin' && targetUser?.role === 'superadmin') return false;
    if (currentUser?.role === 'admin') return true;
    if (isGestor && ['admin', 'superadmin'].includes(targetUser?.role)) return false;
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
      await alert(err.response?.data?.error || 'Erro ao alterar status', {
        title: 'Erro',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (user) => {
    const ok = await confirm(`Remover o usuário "${user.name}"? Esta ação não pode ser desfeita.`, {
      title: 'Remover Usuário',
      variant: 'danger',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${user.id}`);
      fetchUsers();
    } catch (err) {
      await alert(err.response?.data?.error || 'Erro ao remover usuário', {
        title: 'Erro',
        variant: 'error',
      });
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
        <div className="users-header-left">
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/configuracoes')} title="Voltar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div>
            <h1 className="dashboard-title">Usuários</h1>
            <p className="dashboard-date">
              {isRH ? 'Visualização geral — você só pode editar o seu próprio cadastro.' : 'Gerenciamento de contas e permissões'}
            </p>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
            </svg>
            Atualizar
          </button>
          {!isRH && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Usuário
          </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="users-search-wrap">
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
                  <td data-label="Nome">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar-sm">
                        {(u.name || u.username).split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500, color: 'var(--gray-900)', fontSize: 13 }}>{u.name || u.username}</span>
                    </div>
                  </td>
                  <td data-label="Usuário" style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.username}</td>
                  <td data-label="E-mail" style={{ fontSize: 13, color: 'var(--gray-500)' }}>{u.email || '—'}</td>
                  <td data-label="Cargo"><RoleBadge role={u.role} /></td>
                  <td data-label="Status">
                    {canManageUserLifecycle(u) ? (
                      <button
                        className={`status-toggle ${u.active ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleActive(u)}
                        title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        <span className="status-toggle-dot" />
                        {u.active ? 'Ativo' : 'Inativo'}
                      </button>
                    ) : (
                      <span className={`status-toggle status-readonly ${u.active ? 'active' : 'inactive'}`} title={isRH ? 'Somente leitura (RH)' : 'Somente leitura'}>
                        <span className="status-toggle-dot" />
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </td>
                  <td data-label="Ações">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {canEditUser(u) ? (
                        <>
                          <button className="task-action-btn" title="Editar" onClick={() => { setEditing(u); setModalOpen(true); }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          {canManageUserLifecycle(u) && (
                          <button className="task-action-btn red" title="Remover" onClick={() => handleDelete(u)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                          )}
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
          currentUserId={currentUser?.id}
        />
      )}

      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .users-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .users-search-wrap { margin-bottom: 20px; max-width: 360px; position: relative; }

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
        .status-toggle.active { color: var(--green-600); background: var(--green-50); border-color: var(--green-100); }
        .status-toggle.inactive { color: var(--gray-500); background: var(--gray-100); border-color: var(--gray-200); }
        .status-toggle:hover { filter: brightness(0.93); }
        .status-toggle.status-readonly { cursor: default; pointer-events: none; }
        .status-toggle.status-readonly:hover { filter: none; }
        .status-toggle-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: currentColor;
        }

        .task-action-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--gray-500); transition: all var(--transition); }
        .task-action-btn:hover { background: var(--gray-100); color: var(--gray-700); border-color: var(--gray-300); }
        .task-action-btn.red:hover { background: var(--red-50); color: var(--red-600); border-color: var(--red-100); }

        .tasks-loading { display: flex; align-items: center; gap: 10px; padding: 40px 20px; color: var(--gray-400); font-size: 14px; }

        @media (max-width: 900px) {
          .dashboard { padding: 20px 16px; }
          .users-header-left { width: 100%; }
          .dashboard-header-actions { width: 100%; }
          .users-search-wrap { max-width: 100%; }
          .users-table-wrap { overflow-x: auto; }
        }
        @media (max-width: 700px) {
          .users-table thead { display: none; }
          .users-table,
          .users-table tbody,
          .users-table tr,
          .users-table td { display: block; width: 100%; }
          .users-table tbody tr {
            opacity: 1 !important;
            border-bottom: 1px solid var(--gray-200);
            padding: 10px 12px;
          }
          .users-table td {
            border-bottom: 1px dashed var(--gray-100);
            padding: 8px 0;
          }
          .users-table td:last-child { border-bottom: none; }
          .users-table td[data-label]::before {
            content: attr(data-label);
            display: block;
            font-size: 10px;
            font-weight: 700;
            color: var(--gray-400);
            text-transform: uppercase;
            letter-spacing: .06em;
            margin-bottom: 4px;
          }
        }
      `}</style>
    </div>
  );
}
