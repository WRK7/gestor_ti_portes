import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import TaskModal from '../components/TaskModal';
import { useAuth } from '../contexts/AuthContext';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow = diffDays >= 0 && diffDays < 1 && !isToday;

  if (isToday) return 'Hoje';
  if (isTomorrow) return 'Amanhã';
  if (Math.abs(diffDays) <= 6) return dayNames[date.getDay()];
  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatDevTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

const statusConfig = {
  overdue:   { label: 'Atrasada',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
  pending:   { label: 'Pendente',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  paused:    { label: 'Pausada',   color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', dot: '#818cf8' },
  completed: { label: 'Concluída', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
};

const priorityConfig = {
  critical: { label: 'Crítico', color: '#dc2626' },
  high:     { label: 'Alta',    color: '#d97706' },
  medium:   { label: 'Média',   color: '#2563eb' },
  low:      { label: 'Baixa',   color: '#6b7280' },
};

function StatCard({ label, value, icon, color, bg }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-bg': bg }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <p className="stat-value">{value ?? '—'}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onComplete, onDelete, onPause, onResume, onSendToBonificacao, readonly }) {
  const cfg = statusConfig[task.status] || statusConfig.pending;
  const pCfg = priorityConfig[task.priority] || priorityConfig.medium;
  const isRunning = task.status === 'pending' && task.timer_started_at;

  return (
    <div className="task-card" style={{ '--card-border': cfg.border, '--card-bg': cfg.bg }}>
      <div className="task-card-top">
        <div className="task-card-meta">
          <span className="task-date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formatDate(task.due_date)}
          </span>
          <span className="task-time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatTime(task.due_date)}
          </span>
        </div>
        <div className="task-card-badges">
          <span className="task-status-dot" style={{ background: cfg.dot }} />
          <span className="task-status-label" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      <div className="task-card-body">
        <h3 className="task-title">{task.title}</h3>
        {task.description && (
          <p className="task-desc">{task.description}</p>
        )}
      </div>

      {/* Dev time display */}
      <div className="task-dev-time">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span className="task-dev-time-value">
          {formatDevTime(task.current_dev_seconds || 0)}
        </span>
        {isRunning && <span className="task-timer-badge">em andamento</span>}
      </div>

      <div className="task-card-footer">
        <div className="task-tags">
          {task.category_name && (
            <span className="task-tag" style={{ background: `${task.category_color}18`, color: task.category_color, borderColor: `${task.category_color}30` }}>
              {task.category_name}
            </span>
          )}
          <span className="task-tag" style={{ color: pCfg.color, background: `${pCfg.color}12`, borderColor: `${pCfg.color}25` }}>
            {pCfg.label}
          </span>
          {task.assignees && task.assignees.length > 0 && (
            task.assignees.slice(0, 2).map(u => (
              <span key={u.id} className="task-tag gray">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                {u.name.split(' ')[0]}
              </span>
            ))
          )}
          {task.assignees && task.assignees.length > 2 && (
            <span className="task-tag gray">+{task.assignees.length - 2}</span>
          )}
        </div>
        {!readonly && (
          <div className="task-actions">
            {task.status === 'pending' && (
              <button className="task-action-btn pause-btn" title="Pausar" onClick={() => onPause(task.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              </button>
            )}
            {task.status === 'paused' && (
              <button className="task-action-btn play-btn" title="Retomar" onClick={() => onResume(task.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
            )}
            {task.status !== 'completed' && (
              <button className="task-action-btn green" title="Concluir" onClick={() => onComplete(task.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            )}
            {task.status === 'completed' && (
              <button className="task-action-btn bonif-btn" title="Enviar para bonificação" onClick={() => onSendToBonificacao(task.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </button>
            )}
            <button className="task-action-btn" title="Editar" onClick={() => onEdit(task)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button className="task-action-btn red" title="Remover" onClick={() => onDelete(task.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const readonly = user?.role === 'gestor';

  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const timerRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, statsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/tasks/stats/today'),
      ]);
      setTasks(tasksRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTasks(prev => prev.map(t => {
        if (t.status === 'pending' && t.timer_started_at) {
          return { ...t, current_dev_seconds: (t.current_dev_seconds || 0) + 60 };
        }
        return t;
      }));
    }, 60000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handlePause = async (id) => {
    try {
      await api.patch(`/tasks/${id}/pause`);
      fetchData();
    } catch (err) {
      console.error('Erro ao pausar tarefa:', err);
    }
  };

  const handleResume = async (id) => {
    try {
      await api.patch(`/tasks/${id}/resume`);
      fetchData();
    } catch (err) {
      console.error('Erro ao retomar tarefa:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.patch(`/tasks/${id}/complete`);
      fetchData();
    } catch (err) {
      console.error('Erro ao concluir tarefa:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta tarefa?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      fetchData();
    } catch (err) {
      console.error('Erro ao remover tarefa:', err);
    }
  };

  const handleSendToBonificacao = async (id) => {
    try {
      await api.post(`/projects/from-task/${id}`);
      fetchData();
      alert('Tarefa enviada para bonificação!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao enviar para bonificação';
      alert(msg);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingTask(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchData();
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-date">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
            </svg>
            Atualizar
          </button>
          {!readonly && (
            <button className="btn btn-primary" onClick={handleNewTask}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nova Tarefa
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stats-5">
        <StatCard
          label="Total"
          value={stats?.total}
          color="#2563eb"
          bg="#eff6ff"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          }
        />
        <StatCard
          label="Concluídas"
          value={stats?.completed}
          color="#16a34a"
          bg="#f0fdf4"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          }
        />
        <StatCard
          label="Pendentes"
          value={stats?.pending}
          color="#d97706"
          bg="#fffbeb"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        <StatCard
          label="Pausadas"
          value={stats?.paused}
          color="#6366f1"
          bg="#eef2ff"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          }
        />
        <StatCard
          label="Atrasadas"
          value={stats?.overdue}
          color="#dc2626"
          bg="#fef2f2"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
      </div>

      {/* Filter tabs */}
      <div className="tasks-section">
        <div className="tasks-header">
          <div className="filter-tabs">
            {[
              { key: 'all',       label: 'Todas' },
              { key: 'overdue',   label: 'Atrasadas' },
              { key: 'pending',   label: 'Pendentes' },
              { key: 'paused',    label: 'Pausadas' },
              { key: 'completed', label: 'Concluídas' },
            ].map(f => (
              <button
                key={f.key}
                className={`filter-tab${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="filter-tab-count">
                  {f.key === 'all' ? tasks.length : tasks.filter(t => t.status === f.key).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="tasks-loading">
            <div className="spinner" />
            <span>Carregando tarefas...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <p>Nenhuma tarefa {filter !== 'all' ? statusConfig[filter]?.label?.toLowerCase() : ''} encontrada</p>
          </div>
        ) : (
          <div className="tasks-grid">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onPause={handlePause}
                onResume={handleResume}
                onSendToBonificacao={handleSendToBonificacao}
                readonly={readonly}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      <style>{`
        .dashboard {
          padding: 28px 32px;
          width: 100%;
        }
        .dashboard-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
        }
        .dashboard-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--gray-900);
          letter-spacing: -0.3px;
        }
        .dashboard-date {
          font-size: 13px;
          color: var(--gray-400);
          margin-top: 2px;
        }
        .dashboard-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .stats-5 {
          grid-template-columns: repeat(5, 1fr);
        }
        .stat-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--gray-200);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition);
        }
        .stat-card:hover { box-shadow: var(--shadow-md); }
        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--stat-bg);
          color: var(--stat-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 700;
          color: var(--gray-900);
          line-height: 1;
          letter-spacing: -0.5px;
        }
        .stat-label {
          font-size: 12px;
          color: var(--gray-500);
          margin-top: 4px;
          font-weight: 500;
        }
        .tasks-section { }
        .tasks-header {
          margin-bottom: 16px;
        }
        .filter-tabs {
          display: flex;
          gap: 4px;
          background: var(--gray-100);
          padding: 4px;
          border-radius: 10px;
          width: fit-content;
        }
        .filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-600);
          background: none;
          border: none;
          cursor: pointer;
          transition: all var(--transition);
          font-family: inherit;
        }
        .filter-tab:hover { color: var(--gray-900); }
        .filter-tab.active {
          background: var(--white);
          color: var(--gray-900);
          box-shadow: var(--shadow-sm);
        }
        .filter-tab-count {
          font-size: 11px;
          font-weight: 600;
          background: var(--gray-200);
          color: var(--gray-600);
          padding: 1px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
        }
        .filter-tab.active .filter-tab-count {
          background: var(--gray-100);
        }
        .tasks-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 40px 0;
          color: var(--gray-400);
          font-size: 14px;
        }
        .tasks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }
        .task-card {
          background: var(--white);
          border-radius: var(--radius-lg);
          border: 1px solid var(--card-border, var(--gray-200));
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow var(--transition), transform var(--transition);
        }
        .task-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .task-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .task-card-meta {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .task-date, .task-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--gray-500);
          font-weight: 500;
        }
        .task-card-badges {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .task-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .task-status-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .task-card-body { }
        .task-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--gray-900);
          line-height: 1.4;
          margin-bottom: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .task-desc {
          font-size: 13px;
          color: var(--gray-500);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .task-dev-time {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--gray-50);
          border-radius: 8px;
          border: 1px solid var(--gray-100);
          color: var(--gray-500);
          font-size: 12px;
          font-weight: 500;
        }
        .task-dev-time-value {
          font-weight: 600;
          color: var(--gray-700);
        }
        .task-timer-badge {
          font-size: 10px;
          font-weight: 600;
          color: #16a34a;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 1px 6px;
          border-radius: 10px;
          animation: pulse-badge 2s ease-in-out infinite;
        }
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .task-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .task-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }
        .task-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          border: 1px solid transparent;
        }
        .task-tag.gray {
          background: var(--gray-100);
          color: var(--gray-600);
          border-color: var(--gray-200);
        }
        .task-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .task-action-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: 1px solid var(--gray-200);
          background: var(--white);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gray-500);
          transition: all var(--transition);
        }
        .task-action-btn:hover {
          background: var(--gray-100);
          color: var(--gray-700);
          border-color: var(--gray-300);
        }
        .task-action-btn.green:hover {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #bbf7d0;
        }
        .task-action-btn.red:hover {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
        }
        .task-action-btn.pause-btn:hover {
          background: #eef2ff;
          color: #6366f1;
          border-color: #c7d2fe;
        }
        .task-action-btn.play-btn {
          background: #eef2ff;
          color: #6366f1;
          border-color: #c7d2fe;
        }
        .task-action-btn.play-btn:hover {
          background: #e0e7ff;
          color: #4f46e5;
          border-color: #a5b4fc;
        }
        .task-action-btn.bonif-btn:hover {
          background: #fffbeb;
          color: #d97706;
          border-color: #fde68a;
        }
        @media (max-width: 1100px) {
          .stats-grid, .stats-5 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 700px) {
          .stats-grid, .stats-5 { grid-template-columns: 1fr; }
          .tasks-grid { grid-template-columns: 1fr; }
          .dashboard { padding: 20px 16px; }
        }
      `}</style>
    </div>
  );
}
