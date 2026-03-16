import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/* ─── helpers ───────────────────────────────────────────────────── */
const formatDevTime = (s) => {
  if (!s || s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const formatDeadline = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const PRIORITY_LABEL = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
const PRIORITY_COLOR = { low: '#6366f1', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

/* ─── sub-components ────────────────────────────────────────────── */
function UserAvatar({ name, username }) {
  const initials = (name || username || '?')
    .split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 26, height: 26, borderRadius: '50%',
      background: 'var(--gray-200)', color: 'var(--gray-700)',
      fontSize: 10, fontWeight: 700, flexShrink: 0,
      border: '2px solid var(--white)',
    }} title={name || username}>
      {initials}
    </span>
  );
}

function AssigneeRow({ assignees }) {
  if (!assignees?.length)
    return <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Sem responsável</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex' }}>
        {assignees.map((a, i) => (
          <span key={a.id} style={{ marginLeft: i > 0 ? -7 : 0, zIndex: assignees.length - i }}>
            <UserAvatar name={a.name} username={a.username} />
          </span>
        ))}
      </div>
      <span style={{ fontSize: 12, color: 'var(--gray-600)', fontWeight: 500 }}>
        {assignees.length === 1
          ? (assignees[0].name || assignees[0].username)
          : `${assignees[0].name || assignees[0].username} +${assignees.length - 1}`}
      </span>
    </div>
  );
}

function LiveTimer({ task }) {
  const secs = useRef(task.current_dev_seconds || task.dev_seconds || 0);
  const [display, setDisplay] = useState(secs.current);

  useEffect(() => {
    secs.current = task.current_dev_seconds || task.dev_seconds || 0;
    setDisplay(secs.current);
    if (task.status !== 'pending') return;
    const id = setInterval(() => { secs.current += 1; setDisplay(secs.current); }, 1000);
    return () => clearInterval(id);
  }, [task.id, task.status, task.current_dev_seconds]);

  const isRunning = task.status === 'pending';
  return (
    <div className="task-dev-time">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      <span className="task-dev-time-value">{formatDevTime(display)}</span>
      {isRunning && <span className="task-timer-badge">em andamento</span>}
    </div>
  );
}

function ManagerTaskCard({ task, accentColor, isOverdue }) {
  const pc = PRIORITY_COLOR[task.priority] || '#999';
  return (
    <div className="task-card" style={{ '--card-border': accentColor + '60' }}>
      {/* top */}
      <div className="task-card-top">
        <div className="task-card-meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isOverdue ? '#ef4444' : 'var(--gray-400)'} strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: 12, color: isOverdue ? '#ef4444' : 'var(--gray-500)', fontWeight: isOverdue ? 600 : 400 }}>
              {formatDeadline(task.due_date)}
            </span>
          </span>
        </div>
        <div className="task-card-badges">
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
            color: pc, background: pc + '18', border: `1px solid ${pc}38`,
          }}>
            {PRIORITY_LABEL[task.priority] || task.priority}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="task-card-body">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
      </div>

      {/* footer */}
      <div className="task-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <AssigneeRow assignees={task.assignees} />
        <LiveTimer task={task} />
      </div>
    </div>
  );
}

/* ─── stat card (igual ao Dashboard) ───────────────────────────── */
function StatCard({ label, value, color, bg, icon }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-bg': bg }}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ─── tabs config ───────────────────────────────────────────────── */
const TABS = [
  { key: 'pending',   label: 'Em andamento', color: '#16a34a', emptyMsg: 'Nenhuma tarefa em andamento no momento' },
  { key: 'paused',    label: 'Pausadas',     color: '#f59e0b', emptyMsg: 'Nenhuma tarefa pausada' },
  { key: 'overdue',   label: 'Atrasadas',    color: '#ef4444', emptyMsg: 'Nenhuma tarefa atrasada', isOverdue: true },
  { key: 'completed', label: 'Concluídas', color: '#6366f1', emptyMsg: 'Nenhuma tarefa concluída' },
];

/* ─── page ──────────────────────────────────────────────────────── */
export default function ModoGestor() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLast]  = useState(null);
  const [activeTab, setTab]     = useState('pending');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/manager/dashboard');
      setData(d);
      setLast(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  const tab     = TABS.find(t => t.key === activeTab);
  const tasks   = data?.[activeTab] ?? [];

  return (
    <div className="dashboard">
      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card {
          background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--gray-200);
          padding: 20px; display: flex; align-items: center; gap: 16px;
          box-shadow: var(--shadow-sm); transition: box-shadow var(--transition);
        }
        .stat-card:hover { box-shadow: var(--shadow-md); }
        .stat-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: var(--stat-bg); color: var(--stat-color);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .stat-value { font-size: 26px; font-weight: 700; color: var(--gray-900); line-height: 1; letter-spacing: -0.5px; }
        .stat-label { font-size: 12px; color: var(--gray-500); margin-top: 4px; font-weight: 500; }
        .tasks-header { margin-bottom: 16px; }
        .filter-tabs { display: flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: 10px; width: fit-content; }
        .filter-tab {
          display: flex; align-items: center; gap: 6px; padding: 6px 14px;
          border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--gray-600);
          background: none; border: none; cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .filter-tab:hover { color: var(--gray-900); }
        .filter-tab.active { background: var(--white); color: var(--gray-900); box-shadow: var(--shadow-sm); }
        .filter-tab-count {
          font-size: 11px; font-weight: 600; background: var(--gray-200); color: var(--gray-600);
          padding: 1px 6px; border-radius: 10px; min-width: 20px; text-align: center;
        }
        .filter-tab.active .filter-tab-count { background: var(--gray-100); }
        .tasks-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--gray-400); font-size: 14px; }
        .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
        .task-card {
          background: var(--white); border-radius: var(--radius-lg);
          border: 1px solid var(--card-border, var(--gray-200)); padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          box-shadow: var(--shadow-sm); transition: box-shadow var(--transition), transform var(--transition);
        }
        .task-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .task-card-top { display: flex; align-items: center; justify-content: space-between; }
        .task-card-meta { display: flex; align-items: center; gap: 10px; }
        .task-card-badges { display: flex; align-items: center; gap: 5px; }
        .task-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .task-title { font-size: 14px; font-weight: 600; color: var(--gray-900); line-height: 1.4; margin-bottom: 6px; }
        .task-desc {
          font-size: 13px; color: var(--gray-500); line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .task-dev-time {
          display: flex; align-items: center; gap: 6px; padding: 6px 10px;
          background: var(--gray-50); border-radius: 8px; border: 1px solid var(--gray-100);
          color: var(--gray-500); font-size: 12px; font-weight: 500; white-space: nowrap;
        }
        .task-dev-time-value { font-weight: 600; color: var(--gray-700); }
        .task-timer-badge {
          font-size: 10px; font-weight: 600; color: #16a34a; background: #f0fdf4;
          border: 1px solid #bbf7d0; padding: 1px 6px; border-radius: 10px;
          animation: pulse-badge 2s ease-in-out infinite;
        }
        @keyframes pulse-badge { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .empty-state {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 60px 20px; color: var(--gray-300);
        }
        .empty-state p { font-size: 14px; color: var(--gray-400); margin: 0; }
        @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .stats-grid { grid-template-columns: 1fr; } .tasks-grid { grid-template-columns: 1fr; } .dashboard { padding: 20px 16px; } }
      `}</style>

      {/* ── header ── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Modo Gestor</h1>
          <p className="dashboard-date">
            Visão geral das tarefas do time
            {lastRefresh && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)' }}>
                · atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.28" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="tasks-loading">
          <div className="spinner" /><span>Carregando...</span>
        </div>
      ) : !data ? (
        <div className="empty-state"><p>Erro ao carregar dados</p></div>
      ) : (
        <>
          {/* ── stat cards ── */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <StatCard
              label="Em andamento" value={data.pending?.length ?? 0}
              color="#16a34a" bg="#f0fdf4"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
            />
            <StatCard
              label="Pausadas" value={data.paused?.length ?? 0}
              color="#f59e0b" bg="#fffbeb"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}
            />
            <StatCard
              label="Atrasadas" value={data.overdue?.length ?? 0}
              color="#ef4444" bg="#fef2f2"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
            <StatCard
              label="Concluídas" value={data.completed?.length ?? 0}
              color="#6366f1" bg="#eef2ff"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>}
            />
          </div>

          {/* ── tab switch + list ── */}
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="filter-tabs">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    className={`filter-tab${activeTab === t.key ? ' active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                    <span className="filter-tab-count">{data[t.key]?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                <p>{tab?.emptyMsg}</p>
              </div>
            ) : (
              <div className="tasks-grid">
                {tasks.map(t => (
                  <ManagerTaskCard
                    key={t.id}
                    task={t}
                    accentColor={tab?.color ?? 'var(--gray-200)'}
                    isOverdue={!!tab?.isOverdue}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
