import { useState } from 'react';
import { createPortal } from 'react-dom';

const fmtMoney = (v) => {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function BonifModal({ project, onClose, onConfirm }) {
  const [mode, setMode]   = useState(null); // null | 'accept' | 'custom'
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleConfirm = async () => {
    setError('');
    let approved_value = null;

    if (mode === 'accept') {
      approved_value = project.suggested_value ?? null;
    } else {
      const raw = value.replace(/[R$\s]/g, '').replace(',', '.');
      if (!raw || isNaN(Number(raw))) {
        setError('Informe um valor válido');
        return;
      }
      approved_value = Number(raw);
    }

    setLoading(true);
    try {
      await onConfirm(project.id, approved_value);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao aprovar bonificação');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--white)', borderRadius: 16, width: 460, maxWidth: '95vw',
        border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-xl)',
        padding: '28px 28px 24px',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', margin: 0, marginBottom: 4 }}>
              Aprovar Bonificação
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* suggested value info */}
        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Valor sugerido pelo time
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: project.suggested_value ? '#16a34a' : 'var(--gray-400)' }}>
            {fmtMoney(project.suggested_value)}
          </div>
          {project.financial_return && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
              Retorno: {project.financial_return}
            </div>
          )}
        </div>

        {/* mode selection */}
        {mode === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setMode('accept')}
              style={{
                padding: '14px 16px', borderRadius: 10, border: '1px solid #bbf7d0',
                background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Aceitar valor proposto
              {project.suggested_value && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{fmtMoney(project.suggested_value)}</span>}
            </button>
            <button
              onClick={() => setMode('custom')}
              style={{
                padding: '14px 16px', borderRadius: 10, border: '1px solid #bfdbfe',
                background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Decidir outro valor
            </button>
          </div>
        )}

        {/* custom value input */}
        {mode === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Valor aprovado (R$)</label>
              <input
                className="input"
                type="text"
                placeholder="Ex.: 1.500,00"
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
              />
            </div>
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setError(''); }}>Voltar</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Aprovando…' : 'Confirmar valor'}
              </button>
            </div>
          </div>
        )}

        {/* accept confirm */}
        {mode === 'accept' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ fontSize: 13, color: '#ef4444' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setError(''); }}>Voltar</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Aprovando…' : `Confirmar — ${fmtMoney(project.suggested_value)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
