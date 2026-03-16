import { useState, useEffect } from 'react';
import api from '../services/api';

const fmt = (val) => (val == null || val === '') ? '' : String(val);

const formatDevTimeDisplay = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

export default function ProjectModal({ project, onClose, onSave }) {
  const isEdit = !!project;
  const isAwaiting = isEdit && project.awaiting_params;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name:             fmt(project?.name),
    description:      fmt(project?.description),
    link:             fmt(project?.link),
    financial_return: fmt(project?.financial_return),
    suggested_value:  fmt(project?.suggested_value),
    responsible_id:   fmt(project?.responsible_id),
  });

  useEffect(() => {
    api.get('/tasks/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const parseSuggestedValue = (val) => {
    if (val == null || val === '') return null;
    const s = String(val).replace(/\s/g, '').replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nome do projeto é obrigatório'); return; }

    if (isAwaiting) {
      if (!form.link && !form.financial_return && !form.suggested_value) {
        setError('Preencha ao menos um campo: link, retorno financeiro ou sugestão de valor');
        return;
      }
    }

    setError('');
    setLoading(true);
    try {
      const payload = {
        name:             form.name || undefined,
        description:      form.description || null,
        link:             form.link || null,
        financial_return: form.financial_return ? String(form.financial_return).trim() : null,
        suggested_value:  parseSuggestedValue(form.suggested_value),
        responsible_id:   form.responsible_id ? Number(form.responsible_id) : null,
      };

      if (isEdit) {
        await api.put(`/projects/${project.id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar projeto');
    } finally {
      setLoading(false);
    }
  };

  const title = isAwaiting
    ? 'Preencher Parâmetros'
    : isEdit
      ? 'Editar Projeto'
      : 'Novo Projeto';

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 580 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="modal-error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Dev time info (read-only) */}
            {isEdit && project.dev_seconds > 0 && (
              <div className="project-dev-time-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Tempo de desenvolvimento: <strong>{formatDevTimeDisplay(project.dev_seconds)}</strong></span>
              </div>
            )}

            {isAwaiting && (
              <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                Preencha os dados abaixo para que o projeto fique disponível para bonificação.
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Nome do Projeto *</label>
              <input
                className="input" type="text"
                placeholder="Ex.: Sistema de Controle de Estoque"
                value={form.name} onChange={set('name')} autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">O que o projeto faz</label>
              <textarea
                className="input"
                placeholder="Descreva a funcionalidade e impacto do projeto..."
                value={form.description} onChange={set('description')} rows={3}
              />
            </div>

            {!isAwaiting && (
              <div className="input-group">
                <label className="input-label">Responsável TI</label>
                <select className="input" value={form.responsible_id} onChange={set('responsible_id')}>
                  <option value="">Nenhum</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Link do Projeto</label>
              <input
                className="input" type="url" placeholder="https://..."
                value={form.link} onChange={set('link')}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Retorno Financeiro</label>
              <textarea
                className="input"
                placeholder="Ex.: Economiza 20h/mês de trabalho manual, reduz custos em R$ 3.000/mês..."
                value={form.financial_return} onChange={set('financial_return')} rows={2}
              />
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                Descreva o impacto financeiro do projeto (economia, receita gerada, etc.)
              </p>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Sugestão de Bonificação pelo TI (R$)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--gray-400)', pointerEvents: 'none' }}>
                  R$
                </span>
                <input
                  className="input" type="number" min="0" step="0.01" placeholder="0,00"
                  value={form.suggested_value} onChange={set('suggested_value')}
                  style={{ paddingLeft: 34 }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                Valor que o TI considera justo como bonificação pelo projeto.
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />
                  Salvando...
                </>
              ) : isAwaiting ? 'Salvar Parâmetros' : isEdit ? 'Salvar Alterações' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 8px;
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .modal-row {
          display: flex;
          gap: 12px;
        }
        .modal-row .input-group {
          margin-bottom: 16px;
        }
        .project-dev-time-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: var(--gray-50);
          border: 1px solid var(--gray-200);
          border-radius: 8px;
          font-size: 13px;
          color: var(--gray-600);
          margin-bottom: 16px;
        }
        .project-dev-time-info strong {
          color: var(--gray-900);
        }
      `}</style>
    </div>
  );
}
