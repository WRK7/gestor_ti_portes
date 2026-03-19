import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import html2pdf from 'html2pdf.js';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmtMoney = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (secs) => {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const DIFFICULTY = {
  baixa:   { label: 'Baixa',   mult: 1.0, color: 'var(--green-600)', bg: 'var(--green-50)',  border: 'var(--green-200)' },
  media:   { label: 'Média',   mult: 1.5, color: 'var(--blue-600)',  bg: 'var(--blue-50)',   border: 'var(--blue-200)'  },
  alta:    { label: 'Alta',    mult: 2.0, color: 'var(--amber-600)', bg: 'var(--amber-50)',  border: 'var(--amber-200)' },
  critica: { label: 'Crítica', mult: 3.0, color: 'var(--red-600)',   bg: 'var(--red-50)',    border: 'var(--red-200)'   },
};

const ROLE_LABEL = { superadmin: 'Super Admin', admin: 'Admin', dev: 'Desenvolvedor', suporte: 'Suporte', gestor: 'Gestor', rh: 'RH' };

const billingStorageKey = (userId) => (userId ? `gestor_ti_billing_filter_${userId}` : null);

function readBillingFilter(userId) {
  const key = billingStorageKey(userId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { month: m, year: y } = JSON.parse(raw);
    if (typeof m === 'number' && m >= 1 && m <= 12 && typeof y === 'number' && y >= 2000 && y <= 2100)
      return { month: m, year: y };
  } catch { /* ignore */ }
  return null;
}

function writeBillingFilter(userId, month, year) {
  const key = billingStorageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ month, year }));
  } catch { /* ignore */ }
}

/** Anos permitidos no filtro: ano atual ±1 e mais um ano atrás (evita lista gigante) */
function clampBillingYear(y, cy) {
  const min = cy - 2;
  const max = cy + 1;
  return Math.min(Math.max(Number(y) || cy, min), max);
}

/* ─── BillingCard ──────────────────────────────────────────────── */
function BillingCard({ project, index }) {
  const diff   = project.difficulty ? DIFFICULTY[project.difficulty] : null;
  const hours  = project.dev_seconds ? project.dev_seconds / 3600 : null;
  const rate   = project.hourly_rate ? Number(project.hourly_rate) : null;
  const mult   = diff?.mult ?? 1;
  const calcVal = hours && rate ? hours * rate * mult : null;
  const finalVal = project.approved_value ?? project.suggested_value;

  return (
    <div className="bill-card">
      {/* card header */}
      <div className="bill-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="bill-index">#{String(index).padStart(3, '0')}</span>
          <div>
            <h3 className="bill-project-name">{project.name}</h3>
            {project.source_task_title && (
              <span className="bill-origin">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                Originado da tarefa: <em>{project.source_task_title}</em>
              </span>
            )}
          </div>
        </div>
        <div className="bill-approved-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Aprovado
        </div>
      </div>

      <div className="bill-card-body">
        {/* left col — info */}
        <div className="bill-col-info">
          {/* collaborators */}
          {project.collaborators?.length > 0 ? (
            <div className="bill-field">
              <span className="bill-field-label">Colaboradores</span>
              <div className="bill-collaborators">
                {project.collaborators.map(c => (
                  <div key={c.id} className="bill-collaborator">
                    <span className="bill-avatar">
                      {(c.name || c.username || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <span className="bill-collab-name">{c.name || c.username}</span>
                    <span className="bill-role-chip">{ROLE_LABEL[c.role] || c.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : project.responsible_name && (
            <div className="bill-field">
              <span className="bill-field-label">Responsável</span>
              <span className="bill-field-value">
                {project.responsible_name}
                {project.responsible_role && (
                  <span className="bill-role-chip">{ROLE_LABEL[project.responsible_role] || project.responsible_role}</span>
                )}
              </span>
            </div>
          )}

          {/* description */}
          {project.description && (
            <div className="bill-field">
              <span className="bill-field-label">O que entrega</span>
              <span className="bill-field-value bill-desc">{project.description}</span>
            </div>
          )}

          {/* financial return */}
          {project.financial_return && (
            <div className="bill-field">
              <span className="bill-field-label">Retorno financeiro</span>
              <span className="bill-field-value bill-desc">{project.financial_return}</span>
            </div>
          )}

          {/* link */}
          {project.link && (
            <div className="bill-field">
              <span className="bill-field-label">Link</span>
              <a href={project.link} target="_blank" rel="noreferrer" className="bill-link">
                {project.link}
              </a>
            </div>
          )}
        </div>

        {/* right col — billing breakdown */}
        <div className="bill-col-calc">
          <div className="bill-calc-box">
            <p className="bill-calc-title">Composição do valor</p>

            {/* dev time */}
            {fmtTime(project.dev_seconds) && (
              <div className="bill-calc-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="bill-calc-label">Tempo de desenvolvimento</span>
                <span className="bill-calc-val">{fmtTime(project.dev_seconds)}</span>
              </div>
            )}

            {/* hourly rate */}
            {rate && (
              <div className="bill-calc-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <span className="bill-calc-label">Taxa por hora</span>
                <span className="bill-calc-val">{fmtMoney(rate)}/h</span>
              </div>
            )}

            {/* difficulty */}
            {diff && (
              <div className="bill-calc-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
                <span className="bill-calc-label">Dificuldade</span>
                <span
                  className="bill-diff-chip"
                  style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.border}` }}
                >
                  {diff.label} ×{diff.mult}
                </span>
              </div>
            )}

            {/* formula */}
            {calcVal && (
              <div className="bill-formula">
                <span>{hours?.toFixed(2)}h</span>
                <span className="bill-op">×</span>
                <span>{fmtMoney(rate)}/h</span>
                {diff && <><span className="bill-op">×</span><span>{diff.mult}</span></>}
                <span className="bill-op">=</span>
                <span className="bill-formula-result">{fmtMoney(calcVal)}</span>
              </div>
            )}

            {/* suggested vs approved */}
            <div className="bill-values-row">
              {project.suggested_value && (
                <div className="bill-value-item">
                  <span className="bill-value-label">Sugerido pelo time</span>
                  <span className="bill-value-num bill-suggested">{fmtMoney(project.suggested_value)}</span>
                </div>
              )}
              <div className="bill-value-item">
                <span className="bill-value-label">Valor aprovado</span>
                <span className="bill-value-num bill-approved">{fmtMoney(finalVal)}</span>
              </div>
            </div>
          </div>

          {/* approval meta */}
          <div className="bill-meta">
            {project.bonificado_by_name && (
              <span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Aprovado por <strong>{project.bonificado_by_name}</strong>
              </span>
            )}
            {project.bonificado_at && (
              <span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {fmtDate(project.bonificado_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Billing page ─────────────────────────────────────────────── */
export default function Billing() {
  const { user } = useAuth();
  const isManager = ['gestor', 'admin', 'superadmin'].includes(user?.role);
  const today = useMemo(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, []);

  const [month,  setMonth]  = useState(today.month);
  const [year,   setYear]   = useState(today.year);
  const [userId, setUserId] = useState('');
  const [users,  setUsers]  = useState([]);
  const [items,  setItems]  = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);
  const [billingReady, setBillingReady] = useState(false);

  // Aplica filtro salvo antes do 1º fetch (evita flash com mês/ano do relógio)
  useEffect(() => {
    if (!user?.id) {
      setBillingReady(false);
      return;
    }
    const saved = readBillingFilter(user.id);
    if (saved) {
      setMonth(saved.month);
      setYear(clampBillingYear(saved.year, today.year));
    }
    setBillingReady(true);
  }, [user?.id]);

  const setMonthAndPersist = (m) => {
    setMonth(m);
    if (user?.id) writeBillingFilter(user.id, m, year);
  };
  const setYearAndPersist = (y) => {
    const next = clampBillingYear(y, today.year);
    setYear(next);
    if (user?.id) writeBillingFilter(user.id, month, next);
  };

  useEffect(() => {
    if (isManager) {
      api.get('/tasks/users').then(r => setUsers(r.data)).catch(() => {});
    }
  }, [isManager]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month, year });
      if (userId) params.set('responsible_id', userId);
      const { data } = await api.get(`/projects/billing?${params}`);
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, userId]);

  useEffect(() => {
    if (!billingReady) return;
    fetchData();
  }, [billingReady, fetchData]);

  const totalApproved = items.reduce((s, p) => s + Number(p.approved_value ?? p.suggested_value ?? 0), 0);
  const totalSuggested = items.reduce((s, p) => s + Number(p.suggested_value ?? 0), 0);
  const avgVal = items.length ? totalApproved / items.length : 0;
  const selectedUserName = users.find(u => String(u.id) === String(userId))?.name || '';

  const cy = today.year;
  const years = useMemo(() => {
    const arr = [];
    for (let y = cy + 1; y >= cy - 2; y--) arr.push(y);
    const ySel = clampBillingYear(year, cy);
    if (!arr.includes(ySel)) {
      arr.push(ySel);
      arr.sort((a, b) => b - a);
    }
    return arr;
  }, [cy, year]);

  const handlePrint = () => window.print();

  const [exporting, setExporting] = useState(false);

  const handleDownloadPdf = async () => {
    if (!printRef.current || exporting) return;
    setExporting(true);
    let exportRoot = null;
    try {
      const filename = `billing_${MONTH_NAMES[month - 1].toLowerCase()}_${year}${
        selectedUserName
          ? `_${selectedUserName.replace(/\s+/g, '_')}`
          : ''
      }.pdf`;

      const sourceEl = printRef.current;
      const clone = sourceEl.cloneNode(true);
      clone.classList.add('pdf-exporting');

      exportRoot = document.createElement('div');
      exportRoot.style.position = 'fixed';
      exportRoot.style.left = '-10000px';
      exportRoot.style.top = '0';
      exportRoot.style.width = `${sourceEl.scrollWidth}px`;
      exportRoot.style.background = '#ffffff';
      exportRoot.style.zIndex = '-1';
      exportRoot.style.pointerEvents = 'none';
      exportRoot.appendChild(clone);
      document.body.appendChild(exportRoot);

      // Aguarda um frame para garantir layout estável antes do snapshot.
      await new Promise(resolve => requestAnimationFrame(resolve));

      await html2pdf()
        .set({
          margin:      [8, 8, 8, 8],
          filename,
          image:       { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            windowWidth: clone.scrollWidth,
          },
          jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak:   { mode: ['css', 'legacy'] },
        })
        .from(clone)
        .save();
    } finally {
      if (exportRoot && exportRoot.parentNode) exportRoot.parentNode.removeChild(exportRoot);
      setExporting(false);
    }
  };

  return (
    <div className="billing-page" ref={printRef}>
      {/* ── toolbar: título + botões ── */}
      <div className="billing-topbar no-print">
        <div>
          <h1 className="billing-title">Billing</h1>
          <p className="billing-subtitle">Relatório de bonificações aprovadas</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={exporting || items.length === 0} title="Baixar PDF">
            {exporting ? (
              <div className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {exporting ? 'Gerando…' : 'Baixar PDF'}
          </button>
          <button className="btn btn-secondary" onClick={handlePrint} title="Imprimir">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      {/* ── filtros: dropdowns em linha ── */}
      <div className="billing-filters no-print">
        <select className="input billing-select" value={month} onChange={e => setMonthAndPersist(Number(e.target.value))}>
          {MONTH_NAMES.map((n, i) => (
            <option key={i+1} value={i+1}>{n}</option>
          ))}
        </select>

        <select className="input billing-select" value={year} onChange={e => setYearAndPersist(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {isManager && (
          <select className="input billing-select billing-select-user" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Todos os responsáveis</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* ── print header (only visible when printing) ── */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Relatório de Billing</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            {MONTH_NAMES[month - 1]} {year}{selectedUserName ? ` · ${selectedUserName}` : ''}
          </p>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
          Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── summary cards ── */}
      <div className="billing-summary">
        <div className="bill-stat">
          <span className="bill-stat-label">Projetos bonificados</span>
          <span className="bill-stat-val">{items.length}</span>
        </div>
        <div className="bill-stat bill-stat-highlight">
          <span className="bill-stat-label">Total aprovado</span>
          <span className="bill-stat-val">{fmtMoney(totalApproved)}</span>
        </div>
        <div className="bill-stat">
          <span className="bill-stat-label">Total sugerido</span>
          <span className="bill-stat-val">{fmtMoney(totalSuggested)}</span>
        </div>
        <div className="bill-stat">
          <span className="bill-stat-label">Média por projeto</span>
          <span className="bill-stat-val">{items.length ? fmtMoney(avgVal) : '—'}</span>
        </div>
      </div>

      {/* ── content ── */}
      {loading ? (
        <div className="billing-loading">
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <span>Carregando relatório...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="billing-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>Nenhuma bonificação aprovada em {MONTH_NAMES[month-1]} {year}</p>
          <p className="billing-empty-hint">
            Filtro pelo <strong>mês/ano em que a bonificação foi aprovada</strong>. Troque mês/ano acima se não houver dados neste período.
          </p>
        </div>
      ) : (
        <div className="billing-list">
          {items.map((p, i) => (
            <BillingCard key={p.id} project={p} index={i + 1} />
          ))}

          {/* total footer */}
          <div className="bill-total-footer">
            <span>{items.length} projeto{items.length !== 1 ? 's' : ''} · {MONTH_NAMES[month-1]} {year}</span>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              {totalSuggested > 0 && totalSuggested !== totalApproved && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>Sugerido</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-500)' }}>{fmtMoney(totalSuggested)}</div>
                </div>
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>Total aprovado</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green-600)' }}>{fmtMoney(totalApproved)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .billing-page {
          padding: 28px;
          max-width: 980px;
          margin: 0 auto;
        }
        .billing-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }
        .billing-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--gray-900);
          margin: 0 0 2px;
        }
        .billing-subtitle {
          font-size: 13px;
          color: var(--gray-400);
          margin: 0;
        }
        .billing-filters {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 20px;
        }
        .billing-select {
          flex: 1;
          min-width: 120px;
          max-width: 180px;
        }
        .billing-select-user {
          max-width: 240px;
        }

        /* summary */
        .billing-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .bill-stat {
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
        }
        .bill-stat-highlight {
          background: var(--green-50);
          border-color: var(--green-200);
        }
        .bill-stat-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--gray-400);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .bill-stat-val {
          display: block;
          font-size: 20px;
          font-weight: 800;
          color: var(--gray-900);
        }
        .bill-stat-highlight .bill-stat-val { color: var(--green-600); }

        /* loading / empty */
        .billing-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 80px 0;
          color: var(--gray-400);
          font-size: 14px;
        }
        .billing-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 0;
          gap: 16px;
          color: var(--gray-400);
          text-align: center;
        }
        .billing-empty p { font-size: 14px; margin: 0; }
        .billing-empty-hint {
          max-width: 420px;
          font-size: 12px !important;
          line-height: 1.5;
          color: var(--gray-500);
        }

        /* list */
        .billing-list { display: flex; flex-direction: column; gap: 16px; }

        /* card */
        .bill-card {
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .bill-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--gray-100);
          background: var(--gray-50);
          gap: 12px;
        }
        .bill-index {
          font-size: 11px;
          font-weight: 700;
          color: var(--gray-400);
          font-family: monospace;
          background: var(--gray-100);
          border-radius: 6px;
          padding: 3px 7px;
          flex-shrink: 0;
        }
        .bill-project-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--gray-900);
          margin: 0 0 2px;
        }
        .bill-origin {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--gray-400);
        }
        .bill-origin em { font-style: normal; color: var(--gray-600); }
        .bill-approved-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          color: var(--green-600);
          background: var(--green-50);
          border: 1px solid var(--green-200);
          border-radius: 20px;
          padding: 4px 10px;
          flex-shrink: 0;
        }

        /* card body */
        .bill-card-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        .bill-col-info {
          padding: 20px;
          border-right: 1px solid var(--gray-100);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .bill-col-calc {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        /* fields */
        .bill-field { display: flex; flex-direction: column; gap: 3px; }
        .bill-field-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--gray-400);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .bill-field-value {
          font-size: 13px;
          color: var(--gray-700);
          font-weight: 500;
        }
        .bill-desc {
          line-height: 1.5;
          color: var(--gray-600);
          font-weight: 400;
        }
        .bill-role-chip {
          display: inline-block;
          margin-left: 6px;
          font-size: 10px;
          font-weight: 600;
          color: var(--blue-600);
          background: var(--blue-50);
          border: 1px solid var(--blue-100);
          border-radius: 20px;
          padding: 1px 7px;
          vertical-align: middle;
        }
        .bill-link {
          font-size: 12px;
          color: var(--blue-600);
          word-break: break-all;
        }
        .bill-collaborators {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bill-collaborator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--gray-700);
          font-weight: 500;
        }
        .bill-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--gray-200);
          color: var(--gray-700);
          font-size: 9px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .bill-collab-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* calc box */
        .bill-calc-box {
          background: var(--gray-50);
          border: 1px solid var(--gray-200);
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bill-calc-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--gray-400);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 4px;
        }
        .bill-calc-row {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: var(--gray-600);
        }
        .bill-calc-row svg { color: var(--gray-400); flex-shrink: 0; }
        .bill-calc-label { flex: 1; }
        .bill-calc-val { font-weight: 600; color: var(--gray-800); }
        .bill-diff-chip {
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          padding: 2px 8px;
        }

        /* formula */
        .bill-formula {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          background: var(--blue-50);
          border: 1px solid var(--blue-100);
          border-radius: 8px;
          font-size: 12px;
          color: var(--blue-700);
          font-weight: 500;
          flex-wrap: wrap;
        }
        .bill-op { color: var(--blue-400); font-weight: 700; }
        .bill-formula-result { font-weight: 800; margin-left: 2px; }

        /* values */
        .bill-values-row {
          display: flex;
          gap: 12px;
          padding-top: 6px;
          border-top: 1px dashed var(--gray-200);
        }
        .bill-value-item { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .bill-value-label { font-size: 10px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.05em; }
        .bill-value-num { font-size: 16px; font-weight: 800; }
        .bill-suggested { color: var(--gray-500); }
        .bill-approved  { color: var(--green-600); }

        /* meta */
        .bill-meta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--gray-400);
        }
        .bill-meta span {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .bill-meta strong { color: var(--gray-600); }

        /* total footer */
        .bill-total-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
          font-size: 13px;
          color: var(--gray-500);
          font-weight: 500;
        }

        /* print */
        .print-header { display: none; }

        /* pdf-exporting: simula @media print para html2pdf */
        .pdf-exporting .no-print { display: none !important; }
        .pdf-exporting .print-header {
          display: flex !important;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e5e7eb;
        }
        .pdf-exporting {
          padding: 24px;
          max-width: 100%;
          background: #ffffff !important;
          color: #111827 !important;
          /* Força paleta clara/legível no PDF, independente do tema ativo */
          --white: #ffffff;
          --gray-50: #f9fafb;
          --gray-100: #f3f4f6;
          --gray-200: #e5e7eb;
          --gray-300: #d1d5db;
          --gray-400: #6b7280;
          --gray-500: #4b5563;
          --gray-600: #374151;
          --gray-700: #1f2937;
          --gray-900: #111827;
          --blue-50: #eff6ff;
          --blue-100: #dbeafe;
          --blue-400: #60a5fa;
          --blue-700: #1d4ed8;
          --green-50: #f0fdf4;
          --green-200: #bbf7d0;
          --green-600: #16a34a;
        }
        .pdf-exporting * {
          text-shadow: none !important;
          filter: none !important;
        }
        .pdf-exporting .billing-summary { break-inside: avoid; }
        .pdf-exporting .bill-card { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
        .pdf-exporting .bill-stat { border: 1px solid #e5e7eb; background: #f9fafb !important; }
        .pdf-exporting .bill-stat-highlight { background: #f0fdf4 !important; }
        .pdf-exporting .bill-calc-box { background: #f9fafb !important; }
        .pdf-exporting .bill-formula { background: #eff6ff !important; }
        .pdf-exporting .billing-list { gap: 12px; }
        .pdf-exporting .bill-card-header { background: #f9fafb !important; }
        .pdf-exporting .bill-col-info { background: #111827 !important; }
        .pdf-exporting .bill-col-info,
        .pdf-exporting .bill-col-info * { color: #e5e7eb !important; }
        .pdf-exporting .bill-approved { color: #16a34a !important; }

        @media (max-width: 700px) {
          .billing-summary { grid-template-columns: repeat(2, 1fr); }
          .bill-card-body  { grid-template-columns: 1fr; }
          .bill-col-info   { border-right: none; border-bottom: 1px solid var(--gray-100); }
        }

        @media print {
          /* hide sidebar and chrome */
          .no-print { display: none !important; }
          .sidebar  { display: none !important; }
          .layout   { display: block !important; height: auto !important; overflow: visible !important; }
          .main-content {
            margin-left: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          .page-content {
            overflow: visible !important;
            height: auto !important;
          }

          .print-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e5e7eb;
          }
          .billing-page { padding: 24px; max-width: 100%; }
          .billing-summary { break-inside: avoid; }
          .bill-card { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
          .bill-stat { border: 1px solid #e5e7eb; background: #f9fafb !important; }
          .bill-stat-highlight { background: #f0fdf4 !important; }
          .bill-calc-box { background: #f9fafb !important; }
          .bill-formula { background: #eff6ff !important; }
          .billing-list { gap: 12px; }
          .bill-card-header { background: #f9fafb !important; }
        }
      `}</style>
    </div>
  );
}
