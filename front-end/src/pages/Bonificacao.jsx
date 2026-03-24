import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import ProjectModal from '../components/ProjectModal';
import BonifModal from '../components/BonifModal';
import DevNegotiationModal from '../components/DevNegotiationModal';
import CalendarModal from '../components/CalendarModal';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';

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

function bonifStatusLabel(project, isAwaiting) {
  if (isAwaiting) return { text: 'Aguardando parâmetros', color: '#d97706', dot: '#f59e0b' };
  if (project.bonificado) return { text: 'Bonificado', color: '#16a34a', dot: '#22c55e' };
  if (project.bonif_pending_response === 'dev') return { text: 'Aguardando dev', color: '#7c3aed', dot: '#8b5cf6' };
  return { text: 'Aguardando gestor', color: '#2563eb', dot: '#3b82f6' };
}

function participantStatus(bp) {
  if (bp.awaiting_params) return { text: 'Aguardando parâmetros', color: '#d97706', dot: '#f59e0b' };
  if (bp.bonificado) return { text: 'Bonificado', color: '#16a34a', dot: '#22c55e' };
  if (bp.bonif_pending_response === 'dev') return { text: 'Aguardando dev', color: '#7c3aed', dot: '#8b5cf6' };
  return { text: 'Aguardando gestor', color: '#2563eb', dot: '#3b82f6' };
}

function ProjectCard({
  project,
  currentUserId,
  onEdit,
  onDelete,
  onToggleBonificado,
  onDevRespond,
  isAwaiting,
  canBonify,
  canRespondDev,
  canEditProject,
  canDeleteProject,
  canFillSingleParams,
  readOnly,
}) {
  const parts = project.bonif_participants || [];
  const multi = project.collaborative && parts.length > 1;

  if (multi) {
    const stAgg = bonifStatusLabel(project, isAwaiting);
    return (
      <div className="project-card" style={{ '--card-border': isAwaiting ? '#fde68a' : project.bonificado ? '#bbf7d0' : 'var(--gray-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="project-status-dot" style={{ background: stAgg.dot }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: stAgg.color }}>{stAgg.text}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#4338ca', background: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>Colaborativo</span>
          </div>
          {!readOnly && (canEditProject || canDeleteProject) && (
            <div style={{ display: 'flex', gap: 4 }}>
              {canEditProject && (
                <button className="task-action-btn" title="Editar projeto" type="button" onClick={() => onEdit(project)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              {canDeleteProject && (
                <button className="task-action-btn red" title="Remover" type="button" onClick={() => onDelete(project.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        <h3 className="project-title">{project.name}</h3>
        {!canBonify && !readOnly && !isAwaiting && !project.bonificado && (
          <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Para <strong>aprovar ou negociar</strong> bonificação, entre como <strong>gestor</strong>, <strong>admin</strong> ou <strong>superadmin</strong>. Com dev/suporte você só acompanha.
          </p>
        )}
        {project.description && <p className="project-desc">{project.description}</p>}
        {project.link && (
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <a href={project.link} target="_blank" rel="noreferrer" style={{ color: 'var(--blue-600)' }} onClick={e => e.stopPropagation()}>Link do projeto</a>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {parts.map((bp) => {
            const st = participantStatus(bp);
            const showFill = !readOnly && Boolean(bp.awaiting_params) && bp.user_id === currentUserId;
            const showGestor = !readOnly && canBonify && !Boolean(bp.awaiting_params) && !Boolean(bp.bonificado) && bp.bonif_pending_response !== 'dev';
            const showDev = !readOnly && bp.user_id === currentUserId && bp.bonif_pending_response === 'dev' && !isAwaiting;
            return (
              <div
                key={bp.id}
                style={{
                  border: '1px solid var(--gray-200)',
                  borderRadius: 10,
                  padding: 12,
                  background: 'var(--gray-50)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>{bp.member_name || `Usuário #${bp.user_id}`}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="project-status-dot" style={{ background: st.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.text}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
                  <div>
                    Tempo dev: <strong>{formatDevTime(bp.dev_seconds)}</strong>
                  </div>
                  <div>
                    Sugestão:{' '}
                    <strong style={{ color: 'var(--blue-600)' }}>
                      {fmtMoney(bp.suggested_value ?? 0)}
                    </strong>
                  </div>
                  <div>
                    Bonificação:{' '}
                    <strong style={{ color: bp.bonificado ? 'var(--green-600)' : 'var(--gray-700)' }}>
                      {fmtMoney(bp.approved_value ?? 0)}
                    </strong>
                  </div>
                </div>
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {showFill && (
                      <button type="button" className="task-action-btn fill-params-btn" title="Preencher seus parâmetros" onClick={() => onEdit(project)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                    {showGestor && (
                      <button type="button" className="task-action-btn bonificar-btn" title="Bonificar este membro" onClick={() => onToggleBonificado(project, bp)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23"/>
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </button>
                    )}
                    {showDev && (
                      <button type="button" className="task-action-btn dev-bonif-btn" title="Responder gestor" onClick={() => onDevRespond(project, bp)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </button>
                    )}
                    {Boolean(bp.bonificado) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        OK
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const st = bonifStatusLabel(project, isAwaiting);
  const pending = project.bonif_pending_response || 'gestor';
  const showGestorBonif = !isAwaiting && !project.bonificado && canBonify && pending === 'gestor';
  const showDevRespond = !isAwaiting && !project.bonificado && canRespondDev;
  const showBonifRoleHint =
    !canBonify &&
    !readOnly &&
    !isAwaiting &&
    !project.bonificado &&
    pending === 'gestor';

  return (
    <div className="project-card" style={{ '--card-border': isAwaiting ? '#fde68a' : project.bonificado ? '#bbf7d0' : 'var(--gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="project-status-dot" style={{
            background: st.dot
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>
            {st.text}
          </span>
        </div>

        {!readOnly && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {isAwaiting && canFillSingleParams ? (
            <button className="task-action-btn fill-params-btn" title="Preencher parâmetros" type="button" onClick={() => onEdit(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          ) : !isAwaiting && showGestorBonif ? (
            <button className="task-action-btn bonificar-btn" title="Aprovar ou negociar bonificação" type="button" onClick={() => onToggleBonificado(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>
          ) : !isAwaiting && showDevRespond ? (
            <button className="task-action-btn dev-bonif-btn" title="Responder proposta do gestor" type="button" onClick={() => onDevRespond(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          ) : project.bonificado ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16a34a', padding: '3px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Bonificado
            </span>
          ) : null}
          {!isAwaiting && canEditProject && (
            <button className="task-action-btn" title="Editar" type="button" onClick={() => onEdit(project)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          {canDeleteProject && (
            <button className="task-action-btn red" title="Remover" type="button" onClick={() => onDelete(project.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
        )}
      </div>

      <h3 className="project-title">{project.name}</h3>

      {showBonifRoleHint && (
        <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '0 0 10px', lineHeight: 1.45 }}>
          Para <strong>aprovar ou negociar</strong> bonificação, entre como <strong>gestor</strong>, <strong>admin</strong> ou <strong>superadmin</strong>. Com dev/suporte você só acompanha.
        </p>
      )}

      {project.description && (
        <p className="project-desc">{project.description}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span style={{ fontWeight: 500 }}>Tempo dev:</span>
        <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{formatDevTime(project.dev_seconds)}</span>
      </div>

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
  const { confirm } = useDialog();
  const isRH = user?.role === 'rh';
  const canEditProjectMeta = ['admin', 'superadmin'].includes(user?.role);
  const canDeleteProjectMeta = ['admin', 'superadmin'].includes(user?.role);
  /** Aprovar / negociar bonificação: gestor, admin ou superadmin (não dev/suporte/rh). */
  const canBonify = ['gestor', 'admin', 'superadmin'].includes(user?.role);

  const canRespondDev = (p) =>
    !!p.user_can_negotiate &&
    p.bonif_pending_response === 'dev' &&
    !isRH;

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1); // 1-12
  const [selYear,  setSelYear]  = useState(now.getFullYear());

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // Sempre começar em "Aguardando" — gestor/superadmin também precisam ver projetos que ainda não têm parâmetros
  const [filter, setFilter] = useState('awaiting');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [bonifModal, setBonifModal] = useState(null);
  const [devNegotiationModal, setDevNegotiationModal] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, statsRes] = await Promise.all([
        api.get('/projects', { params: { month: selMonth, year: selYear } }),
        api.get('/projects/stats'),
      ]);
      setProjects(projRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selMonth, selYear]);


  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    const ok = await confirm('Deseja remover este projeto permanentemente?', {
      title: 'Remover Projeto',
      variant: 'danger',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    try { await api.delete(`/projects/${id}`); fetchData(); } catch (err) { console.error(err); }
  };

  const handleToggleBonificado = (project, participant) => {
    if (project.bonificado) return;
    setBonifModal({ project, participant: participant || null });
  };

  const handleBonifConfirm = async (projectId, payload) => {
    await api.patch(`/projects/${projectId}/bonificar`, payload);
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
    { key: 'awaiting', label: 'Aguardando Parâmetros' },
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
          color="var(--blue-600)" bg="var(--blue-50)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        />
        <StatCard label="Aguardando parâmetros" value={stats?.awaiting}
          color="var(--amber-600)" bg="var(--amber-50)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
        <StatCard label="Pendentes de bonificação" value={stats?.pending}
          color="var(--blue-600)" bg="var(--blue-50)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard label="Já bonificados" value={stats?.bonificado}
          color="var(--green-600)" bg="var(--green-50)"
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
                currentUserId={user?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleBonificado={handleToggleBonificado}
                onDevRespond={(proj, part) => setDevNegotiationModal({ project: proj, participant: part || null })}
                isAwaiting={!!p.awaiting_params}
                canBonify={canBonify}
                canRespondDev={canRespondDev(p)}
                canEditProject={canEditProjectMeta}
                canDeleteProject={canDeleteProjectMeta}
                canFillSingleParams={
                  !isRH && (
                    canEditProjectMeta ||
                    Number(p.responsible_id) === Number(user?.id) ||
                    Number(p.created_by) === Number(user?.id)
                  )
                }
                readOnly={isRH}
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
          project={bonifModal.project}
          participant={bonifModal.participant || undefined}
          onClose={() => setBonifModal(null)}
          onConfirm={handleBonifConfirm}
        />
      )}

      {devNegotiationModal && (
        <DevNegotiationModal
          project={devNegotiationModal.project}
          participant={devNegotiationModal.participant || undefined}
          onClose={() => setDevNegotiationModal(null)}
          onConfirm={handleBonifConfirm}
        />
      )}

      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
        .dashboard-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

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
        .project-metric-value.green { color: var(--green-600); }
        .project-metric-value.blue  { color: var(--blue-600); }
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
        .filter-tabs { display: flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: 10px; width: fit-content; max-width: 100%; overflow-x: auto; }
        .filter-tab { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 7px; font-size: 13px; font-weight: 500; color: var(--gray-600); background: none; border: none; cursor: pointer; transition: all var(--transition); font-family: inherit; }
        .filter-tab:hover { color: var(--gray-900); }
        .filter-tab.active { background: var(--white); color: var(--gray-900); box-shadow: var(--shadow-sm); }
        .filter-tab-count { font-size: 11px; font-weight: 600; background: var(--gray-200); color: var(--gray-600); padding: 1px 6px; border-radius: 10px; min-width: 20px; text-align: center; }
        .filter-tab.active .filter-tab-count { background: var(--gray-100); }

        .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

        .task-action-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--gray-200); background: var(--white); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--gray-500); transition: all var(--transition); }
        .task-action-btn:hover { background: var(--gray-100); color: var(--gray-700); border-color: var(--gray-300); }
        .task-action-btn.red:hover { background: var(--red-50); color: var(--red-600); border-color: var(--red-100); }
        .task-action-btn.fill-params-btn { background: var(--amber-50); color: var(--amber-600); border-color: var(--amber-100); }
        .task-action-btn.fill-params-btn:hover { background: var(--amber-100); color: var(--amber-600); border-color: var(--amber-500); }
        .task-action-btn.bonificar-btn:hover { background: var(--amber-50); color: var(--amber-600); border-color: var(--amber-100); }
        .task-action-btn.dev-bonif-btn { background: var(--violet-50, #f5f3ff); color: var(--violet-600, #7c3aed); border-color: #ddd6fe; }
        .task-action-btn.dev-bonif-btn:hover { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }
        @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .stats-grid { grid-template-columns: 1fr; } .tasks-grid { grid-template-columns: 1fr; } .dashboard { padding: 20px 16px; } .filter-tab { white-space: nowrap; } }
      `}</style>
    </div>
  );
}
