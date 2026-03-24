import { useState } from 'react';
import { createPortal } from 'react-dom';

const fmtMoney = (v) => {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtHours = (secs) => {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

export default function DevNegotiationModal({ project, participant, onClose, onConfirm }) {
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ctx = participant || project;
  const partPayload = participant?.id ? { participant_id: participant.id } : {};

  const inst = Math.min(
    12,
    Math.max(1, parseInt(ctx.gestor_offer_installments ?? 1, 10) || 1)
  );
  const gv = ctx.gestor_offer_value != null ? Number(ctx.gestor_offer_value) : null;
  const parcela = gv != null && inst > 1 ? gv / inst : null;

  const handleConfirm = async () => {
    setError('');
    if (mode === 'accept') {
      setLoading(true);
      try {
        await onConfirm(project.id, { action: 'dev_accept', ...partPayload });
        onClose();
      } catch (err) {
        setError(err?.response?.data?.error || 'Erro ao confirmar');
      } finally {
        setLoading(false);
      }
      return;
    }

    const raw = value.replace(/[R$\s]/g, '').replace(',', '.');
    if (!raw || isNaN(Number(raw))) {
      setError('Informe um valor válido');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(project.id, { action: 'dev_counter', approved_value: Number(raw), ...partPayload });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao enviar contraproposta');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
    >
      <div style={{
        background: 'var(--white)', borderRadius: 16, width: 460, maxWidth: '95vw',
        border: '1px solid var(--gray-200)', boxShadow: 'var(--shadow-xl)',
        padding: '28px 28px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', margin: 0, marginBottom: 4 }}>
              Proposta do gestor
            </h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.name}{participant?.member_name ? ` — ${participant.member_name}` : ''}
            </p>
          </div>
          <button onClick={onClose} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Contexto
          </div>
          {ctx.dev_seconds > 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
              Tempo de desenvolvimento: <strong>{fmtHours(ctx.dev_seconds)}</strong>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 8 }}>
            Sua última sugestão: <strong>{fmtMoney(ctx.suggested_value)}</strong>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue-600)' }}>
            {fmtMoney(gv)}
          </div>
          {inst > 1 && parcela != null && (
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
              Parcelamento proposto pelo gestor: <strong>{inst}x</strong> de{' '}
              <strong>{fmtMoney(parcela)}</strong>
            </div>
          )}
        </div>

        {mode === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => setMode('accept')}
              style={{
                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--green-100)',
                background: 'var(--green-50)', color: 'var(--green-600)', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Aceitar proposta do gestor
              {gv != null && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{fmtMoney(gv)}</span>}
            </button>
            <button
              type="button"
              onClick={() => setMode('counter')}
              style={{
                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--amber-100)',
                background: 'var(--amber-50)', color: 'var(--amber-700)', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Solicitar outro valor
            </button>
          </div>
        )}

        {mode === 'counter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Nova sugestão de valor (R$)</label>
              <input
                className="input"
                type="text"
                placeholder="Ex.: 1.500,00"
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
              />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--red-500)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setError(''); }}>Voltar</button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Enviando…' : 'Enviar ao gestor'}
              </button>
            </div>
          </div>
        )}

        {mode === 'accept' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={{ fontSize: 13, color: 'var(--red-500)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setError(''); }}>Voltar</button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Confirmando…' : `Confirmar aceite — ${fmtMoney(gv)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
