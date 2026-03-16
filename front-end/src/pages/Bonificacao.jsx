import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import ProjectModal from '../components/ProjectModal';
import BonifModal from '../components/BonifModal';
import CalendarModal from '../components/CalendarModal';
import { useAuth } from '../contexts/AuthContext';

const fmtMoney = (val) => {
  if (val == null || val === '') return '—';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDevTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color = pct === 100 ? '#16a34a' : pct >= 70 ? '#2563eb' : pct >= 40 ? '#d97706' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 10, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-bg': bg }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <p className="stat-value" style={{ fontSize: 20 }}>{value ?? '—'}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete, onToggleBonificado, isAwaiting, canBonify }) {
  return (
    <div className="project-card" style={{ '--card-border': isAwaiting ? '#fde68a' : project.bonificado ? '#bbf7d0' : 'var(--gray-200)' }}>
      {/* Topo: status badge + botões de ação */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="project-status-dot" style={{
            background: isAwaiting ? '#f59e0b' : project.bonificado ? '#22c55e' : '#3b82f6'
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: isAwaiting ? '#d97706' : project.bonificado ? '#16a34a' : '#2563eb' }}>
            {isAwaiting ? 'Aguardando parâmetros' : project.bonificado ? 'Bonificado' : 'Pendente'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {isAwaiting ? (
            <button className="task-action-btn fill-params-btn" title="Preencher parâmetros" onClick={() => onEdit(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          ) : !project.bonificado && canBonify ? (
            <button className="task-action-btn bonificar-btn" title="Aprovar bonificação" onClick={() => onToggleBonificado(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          ) : project.bonificado && canBonify ? (
            <button className="task-action-btn bonificado-btn" title="Reverter bonificação" onClick={() => onToggleBonificado(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          ) : project.bonificado ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Bonificado
            </span>
          ) : null}
          {!isAwaiting && (
            <button className="task-action-btn" title="Editar" onClick={() => onEdit(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          <button className="task-action-btn red" title="Remover" onClick={() => onDelete(project.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Título — linha própria, sem concorrer com botões */}
      <h3 className="project-title">{project.name}</h3>

      {/* Descrição */}
      {project.description && (
        <p className="project-desc">{project.description}</p>
      )}

      {/* Dev time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontWeight: 500 }}>Tempo dev:</span>
        <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{formatDevTime(project.dev_seconds)}</span>
      </div>

      {/* Métricas (only if params filled) */}
      {!isAwaiting && (
        <div className="project-metrics">
          <div className="project-metric">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            <div>
              <p className="project-metric-label">Retorno financeiro</p>
              <p className="project-metric-value" style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-700)' }}>{project.financial_return || '—'}</p>
            </div>
          </div>
          <div className="project-metric">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <div>
              <p className="project-metric-label">Sugestão TI</p>
              <p className="project-metric-value blue">{fmtMoney(project.suggested_value)}</p>
            </div>
          </div>
          {project.link && (
            <div className="project-metric">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <div>
                <p className="project-metric-label">Link</p>
                <a href={project.link} target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-600, #2563eb)', textDecoration: 'none' }}
                  onClick={e => e.stopPropagation()}
                >
                  Acessar projeto
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="project-card-footer">
        {project.responsible_name && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gray-500)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {project.responsible_name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Bonificacao() {
  const { user } = useAuth();
  const isGestor = user?.role === 'gestor';
  const canBonify = isGestor;

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1); // 1-12
  const [selYear,  setSelYear]  = useState(now.getFullYear());

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState(isGestor ? 'pending' : 'awaiting');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // bonif approval modal
  const [bonifModal, setBonifModal] = useState(null); // project object

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, statsRes, monthlyRes] = await Promise.all([
        api.get('/projects', { params: { month: selMonth, year: selYear } }),
        api.get('/projects/stats'),
        api.get('/projects/stats/monthly'),
      ]);
      setProjects(projRes.data);
      setStats(statsRes.data);
      setMonthlyStats(monthlyRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selMonth, selYear]);


  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este projeto?')) return;
    try { await api.delete(`/projects/${id}`); fetchData(); } catch (err) { console.error(err); }
  };

  const handleToggleBonificado = (project) => {
    if (!project.bonificado) {
      setBonifModal(project); // open approval modal
    } else {
      // revert bonification directly
      api.patch(`/projects/${project.id}/bonificar`).then(fetchData).catch(err => {
        alert(err.response?.data?.error || 'Erro ao reverter bonificação');
      });
    }
  };

  const handleBonifConfirm = async (projectId, approved_value) => {
    await api.patch(`/projects/${projectId}/bonificar`, { approved_value });
    fetchData();
  };

  const handleEdit = (project) => {
    setEditing(project);
    setModalOpen(true);
  };

  const filtered = (() => {
    switch (filter) {
      case 'awaiting':
        return projects.filter(p => p.awaiting_params === 1);
      case 'pending':
        return projects.filter(p => !p.awaiting_params && !p.bonificado);
      case 'bonificado':
        return projects.filter(p => !!p.bonificado);
      default:
        return projects;
    }
  })();

  const filters = [
    ...(!isGestor ? [{ key: 'awaiting', label: 'Aguardando Parâmetros' }] : []),
    { key: 'pending',    label: 'Pendentes' },
    { key: 'bonificado', label: 'Bonificados' },
  ];

  const countForFilter = (key) => {
    switch (key) {
      case 'awaiting':   return projects.filter(p => p.awaiting_params === 1).length;
      case 'pending':    return projects.filter(p => !p.awaiting_params && !p.bonificado).length;
      case 'bonificado': return projects.filter(p => !!p.bonificado).length;
      default: return 0;
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Bonificação</h1>
          <p className="dashboard-date">Projetos desenvolvidos pelo time de T.I.</p>
        </div>
        <div className="dashboard-header-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          {/* Month/Year selector */}
          <select className="input" style={{ height: 34, fontSize: 13, padding: '0 10px', width: 'auto' }}
            value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <select className="input" style={{ height: 34, fontSize: 13, padding: '0 10px', width: 'auto' }}
            value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
            <option value={now.getFullYear()}>{now.getFullYear()}</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCalendarOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Calendário
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatCard label="Total de projetos" value={stats?.total}
          color="#2563eb" bg="#eff6ff"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        />
        <StatCard label="Aguardando parâmetros" value={stats?.awaiting}
          color="#d97706" bg="#fffbeb"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatCard label="Pendentes de bonificação" value={stats?.pending}
          color="#2563eb" bg="#eff6ff"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard label="Já bonificados" value={stats?.bonificado}
          color="#16a34a" bg="#f0fdf4"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>}
        />
      </div>

      {/* Filtros + Lista */}
      <div className="tasks-section">
        <div className="tasks-header">
          <div className="filter-tabs">
            {filters.map(f => (
              <button
                key={f.key}
                className={`filter-tab${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="filter-tab-count">
                  {countForFilter(f.key)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="tasks-loading">
            <div className="spinner" /><span>Carregando projetos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <p>Nenhum projeto encontrado</p>
          </div>
        ) : (
          <div className="tasks-grid">
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleBonificado={handleToggleBonificado}
                isAwaiting={!!p.awaiting_params}
                canBonify={canBonify}
              />
            ))}
          </div>
        )}
      </div>

      {calendarOpen && (
        <CalendarModal
          month={selMonth}
          year={selYear}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {modalOpen && (
        <ProjectModal
          project={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={() => { setModalOpen(false); setEditing(null); fetchData(); }}
        />
      )}

      {bonifModal && (
        <BonifModal
          project={bonifModal}
          onClose={() => setBonifModal(null)}
          onConfirm={handleBonifConfirm}
        />
      )}

      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; }

        .project-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--card-border, var(--gray-200));
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition), transform var(--transition);
        }
        .project-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .project-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .project-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%; flex-shrink: 0;
          margin-top: 1px;
        }
        .project-title {
          font-size: 14px; font-weight: 600;
          color: var(--gray-900); line-height: 1.4;
        }
        .project-desc {
          font-size: 13px; color: var(--gray-500); line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .project-metrics {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          background: var(--gray-50);
          border-radius: var(--radius-sm);
          border: 1px solid var(--gray-100);
        }
        .project-metric {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--gray-400);
        }
        .project-metric-label {
          font-size: 11px; color: var(--gray-400); line-height: 1;
        }
        .project-metric-value {
          font-size: 13px; font-weight: 600; color: var(--gray-800); line-height: 1.3;
        }
        .project-metric-value.green { color: #16a34a; }
        .project-metric-value.blue  { color: #2563eb; }
        .project-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 4px;
          border-top: 1px solid var(--gray-100);
        }

        .tasks-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--gray-400); font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-card { background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--gray-200); padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow-sm); }
        .stat-card:hover { box-shadow: var(--shadow-md); }
        .stat-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--stat-bg); color: var(--stat-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-value { font-size: 20px; font-weight: 700; color: var(--gray-900); line-height: 1; letter-spacing: -0.3px; }
        .stat-label { font-size: 12px; color: var(--gray-500); margin-top: 4px; font-weight: 500; }

        .tasks-header { margin-bottom: 16px; }
        .filter-tabs { display: flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: 10px; width: fit-content; }
        .filter-tab { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--gray-600); background: none; border: none; cursor: pointer; transition: all var(--transition); font-family: inherit; }
        .filter-tab:hover { color: var(--gray-900); }
        .filter-tab.active { background: var(--white); color: var(--gray-900); box-shadow: var(--shadow-sm); }
        .filter-tab-count { font-size: 11px; font-weight: 600; background: var(--gray-200); color: var(--gray-600); padding: 1px 6px; border-radius: 10px; min-width: 20px; text-align: center; }
        .filter-tab.active .filter-tab-count { background: var(--gray-100); }

        .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

        .task-action-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--gray-500); transition: all var(--transition); }
        .task-action-btn:hover { background: var(--gray-100); color: var(--gray-700); border-color: var(--gray-300); }
        .task-action-btn.red:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .task-action-btn.fill-params-btn { background: #fffbeb; color: #d97706; border-color: #fde68a; }
        .task-action-btn.fill-params-btn:hover { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
        .task-action-btn.bonificar-btn:hover { background: #fffbeb; color: #d97706; border-color: #fde68a; }
        .task-action-btn.bonificado-btn { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
        .task-action-btn.bonificado-btn:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

        @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .stats-grid { grid-template-columns: 1fr; } .tasks-grid { grid-template-columns: 1fr; } .dashboard { padding: 20px 16px; } }
      `}</style>
    </div>
  );
}
