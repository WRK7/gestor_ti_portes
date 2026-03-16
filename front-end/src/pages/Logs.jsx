import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ACTION_ICON = {
  criou:                 { icon: '＋', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  editou:                { icon: '✎',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  apagou:                { icon: '✕',  color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  concluiu:              { icon: '✔',  color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  'enviou para bonificação': { icon: '$', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'aprovou bonificação':     { icon: '✔', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  'reverteu bonificação':    { icon: '↩', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  ativou:                { icon: '●',  color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  desativou:             { icon: '○',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const ENTITY_LABEL = { tarefa: 'Tarefa', projeto: 'Projeto', bonificacao: 'Bonificação', usuario: 'Usuário' };
const ENTITY_COLOR = { tarefa: '#6366f1', projeto: '#2563eb', bonificacao: '#d97706', usuario: '#8b5cf6' };

const formatDt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const ROLE_COLOR = { admin: '#ef4444', gestor: '#6366f1', dev: '#2563eb', suporte: '#f59e0b' };

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || '#6b7280';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase',
      color: c, background: c + '18', border: `1px solid ${c}38`,
    }}>{role}</span>
  );
}

export default function Logs() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'admin';

  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [entity,  setEntity]  = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(0);
  const PER_PAGE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: PER_PAGE, offset: page * PER_PAGE };
      if (entity) params.entity = entity;
      const { data } = await api.get('/logs', { params });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [entity, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = search
    ? logs.filter(l =>
        (l.actor_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.action     || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_name|| '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const ENTITY_FILTERS = [
    { key: '', label: 'Todos' },
    { key: 'tarefa',      label: 'Tarefas' },
    { key: 'projeto',     label: 'Projetos' },
    { key: 'bonificacao', label: 'Bonificações' },
    ...(isAdmin ? [{ key: 'usuario', label: 'Usuários' }] : []),
  ];

  return (
    <div className="dashboard">
      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; }
        .filter-tabs { display: flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: 10px; width: fit-content; }
        .filter-tab {
          display: flex; align-items: center; gap: 6px; padding: 6px 14px;
          border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--gray-600);
          background: none; border: none; cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .filter-tab:hover { color: var(--gray-900); }
        .filter-tab.active { background: var(--white); color: var(--gray-900); box-shadow: var(--shadow-sm); }
        .log-table-wrap { background: var(--white); border: 1px solid var(--gray-200); border-radius: 14px; overflow: hidden; }
        .log-table { width: 100%; border-collapse: collapse; }
        .log-table thead tr { background: var(--gray-50); border-bottom: 1px solid var(--gray-200); }
        .log-table th { padding: 11px 16px; text-align: left; font-size: 11px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
        .log-table tbody tr { border-bottom: 1px solid var(--gray-100); transition: background 0.12s; }
        .log-table tbody tr:last-child { border-bottom: none; }
        .log-table tbody tr:hover { background: var(--gray-50); }
        .log-table td { padding: 13px 16px; vertical-align: middle; }
        .log-action-icon { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .tasks-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--gray-400); font-size: 14px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--gray-300); }
        .empty-state p { font-size: 14px; color: var(--gray-400); margin: 0; }
      `}</style>

      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Logs</h1>
          <p className="dashboard-date">Histórico de ações do sistema — {total} registros</p>
        </div>
        <div className="dashboard-header-actions">
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="input"
              style={{ paddingLeft: 32, width: 220, height: 34, fontSize: 13 }}
              placeholder="Buscar…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* entity filter tabs */}
      <div style={{ marginBottom: 20 }}>
        <div className="filter-tabs">
          {ENTITY_FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-tab${entity === f.key ? ' active' : ''}`}
              onClick={() => { setEntity(f.key); setPage(0); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tasks-loading"><div className="spinner" /><span>Carregando logs…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p>Nenhum log encontrado</p>
        </div>
      ) : (
        <>
          <div className="log-table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Tipo</th>
                  <th>Alvo</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const ac = ACTION_ICON[log.action] || { icon: '·', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
                  const ec = ENTITY_COLOR[log.entity] || '#6b7280';
                  return (
                    <tr key={log.id}>
                      <td style={{ paddingRight: 0 }}>
                        <span className="log-action-icon" style={{ color: ac.color, background: ac.bg, border: `1px solid ${ac.border}` }}>
                          {ac.icon}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                        {formatDt(log.created_at)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            background: 'var(--gray-200)', color: 'var(--gray-700)',
                            fontSize: 10, fontWeight: 700,
                          }}>
                            {(log.actor_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-900)', lineHeight: 1.2 }}>
                              {log.actor_name || '—'}
                            </div>
                            {log.actor_role && <RoleBadge role={log.actor_role} />}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 500, color: ac.color }}>{log.action}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                          color: ec, background: ec + '18', border: `1px solid ${ec}38`,
                        }}>
                          {ENTITY_LABEL[log.entity] || log.entity}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray-700)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.entity_name || '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.detail || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {total > PER_PAGE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</button>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                {page + 1} / {Math.ceil(total / PER_PAGE)}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={(page + 1) * PER_PAGE >= total} onClick={() => setPage(p => p + 1)}>Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
