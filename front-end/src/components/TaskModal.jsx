import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';

const toDatetimeLocal = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

function UserMultiSelect({ users, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const handleOpen = () => {
    updateCoords();
    setOpen(p => !p);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      // Don't close if click is inside the portal dropdown
      const portal = document.getElementById('user-select-portal');
      if (portal && portal.contains(e.target)) return;
      setOpen(false);
    };
    // Use capture so we catch it before the modal overlay
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [open]);

  const toggle = (user) => {
    const exists = selected.find(s => s.id === user.id);
    onChange(exists ? selected.filter(s => s.id !== user.id) : [...selected, user]);
  };

  const isSelected = (id) => !!selected.find(s => s.id === id);

  const dropdown = open ? createPortal(
    <div
      id="user-select-portal"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        background: 'var(--white)',
        border: '1px solid var(--gray-200)',
        borderRadius: 8,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        zIndex: 99999,
        maxHeight: 220,
        overflowY: 'auto',
      }}
    >
      {users.length === 0 && (
        <div style={{ padding: '10px 12px', color: 'var(--gray-400)', fontSize: 13 }}>Nenhum usuário disponível</div>
      )}
      {users.map(u => (
        <div
          key={u.id}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(u); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', cursor: 'pointer',
            background: isSelected(u.id) ? 'var(--gray-50)' : 'var(--white)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
          onMouseLeave={e => e.currentTarget.style.background = isSelected(u.id) ? 'var(--gray-50)' : 'var(--white)'}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 5, border: '1.5px solid',
            borderColor: isSelected(u.id) ? 'var(--gray-900)' : 'var(--gray-300)',
            background: isSelected(u.id) ? 'var(--gray-900)' : 'var(--white)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isSelected(u.id) && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                style={{ color: 'var(--gray-50)' }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-900)', lineHeight: 1.3 }}>{u.name}</p>
            <p style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.3 }}>{u.role}</p>
          </div>
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={triggerRef}>
      <div
        className="input"
        style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '6px 10px' }}
        onMouseDown={(e) => { e.preventDefault(); handleOpen(); }}
      >
        {selected.length === 0 && (
          <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Selecionar responsáveis...</span>
        )}
        {selected.map(u => (
          <span key={u.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'var(--gray-900)', color: 'var(--gray-50)',
            borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 500,
          }}>
            {u.name}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(u); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', lineHeight: 1, padding: 0, fontSize: 14 }}
            >×</button>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--gray-400)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </div>
      {dropdown}
    </div>
  );
}

export default function TaskModal({ task, onClose, onSave }) {
  const isEdit = !!task;
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title:       task?.title || '',
    description: task?.description || '',
    due_date:    toDatetimeLocal(task?.due_date) || '',
    priority:    task?.priority || 'medium',
    status:      task?.status || 'pending',
    category_id: task?.category_id || '',
    assignees:   task?.assignees || [],
  });

  useEffect(() => {
    Promise.all([api.get('/tasks/categories'), api.get('/tasks/users')])
      .then(([catRes, usersRes]) => {
        setCategories(catRes.data);
        setUsers(usersRes.data);
      })
      .catch(() => {});
  }, []);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('O título é obrigatório'); return; }
    if (!form.due_date) { setError('A data de vencimento é obrigatória'); return; }
    if (!form.assignees || form.assignees.length === 0) { setError('Atribua pelo menos uma pessoa à tarefa'); return; }
    if (!isEdit && new Date(form.due_date) <= new Date()) {
      setError('A data de vencimento deve ser no futuro'); return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        due_date:    new Date(form.due_date).toISOString(),
        assignees:   form.assignees.map(u => u.id),
      };
      if (isEdit) await api.put(`/tasks/${task.id}`, payload);
      else        await api.post('/tasks', payload);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar tarefa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="modal-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Título *</label>
              <input className="input" type="text" placeholder="Descreva a tarefa..." value={form.title} onChange={set('title')} autoFocus />
            </div>

            <div className="input-group">
              <label className="input-label">Descrição</label>
              <textarea className="input" placeholder="Detalhes adicionais (opcional)..." value={form.description} onChange={set('description')} rows={3} />
            </div>

            <div className="modal-row">
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Prazo limite (vencimento) *</label>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--gray-400)',
                    lineHeight: 1.35,
                    marginTop: -4,
                    marginBottom: 6,
                  }}
                >
                  Até quando a tarefa deve estar concluída (não é a data de criação).
                </span>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.due_date}
                  onChange={set('due_date')}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Prioridade</label>
                <select className="input" value={form.priority} onChange={set('priority')}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Categoria</label>
              <select className="input" value={form.category_id} onChange={set('category_id')}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: isEdit ? 16 : 0 }}>
              <label className="input-label">
                Responsáveis *
                {form.assignees.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                    {form.assignees.length} selecionado{form.assignees.length > 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <UserMultiSelect
                users={users}
                selected={form.assignees}
                onChange={(val) => setForm(p => ({ ...p, assignees: val }))}
              />
            </div>

            {isEdit && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Status</label>
                <select className="input" value={form.status} onChange={set('status')}>
                  <option value="pending">Pendente</option>
                  <option value="completed">Concluída</option>
                  <option value="overdue">Atrasada</option>
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />
                  Salvando...
                </>
              ) : isEdit ? 'Salvar Alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-error {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; background: var(--red-50);
          border: 1px solid var(--red-100); border-radius: var(--radius-sm);
          color: var(--red-600); font-size: 13px; margin-bottom: 16px;
        }
        .modal-row { display: flex; gap: 12px; }
        .modal-row .input-group { margin-bottom: 16px; }
      `}</style>
    </div>
  );
}
