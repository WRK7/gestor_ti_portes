import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const fmtMoney = (v) => {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function buildCalendar(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarModal({ month, year, onClose }) {
  const [byUser,   setByUser]   = useState([]);
  const [pending,  setPending]  = useState([]);
  const [selUser,  setSelUser]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [allUsers, setAllUsers] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [byUserRes, pendingRes, usersRes] = await Promise.all([
        api.get('/projects/stats/by-user', { params: { month, year } }),
        api.get('/projects/pending-by-user', { params: selUser ? { user_id: selUser } : {} }),
        api.get('/users'),
      ]);
      setByUser(byUserRes.data);
      setPending(pendingRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, selUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter byUser by selected agent (affects calendar grid, legend and total)
  const visibleByUser = selUser
    ? byUser.filter(u => String(u.id) === String(selUser))
    : byUser;

  // Build day→projects map only from visible users
  const dayMap = {};
  visibleByUser.forEach(u => {
    const projects = typeof u.projects === 'string' ? JSON.parse(u.projects) : (u.projects || []);
    projects.forEach(p => {
      if (!p.bonificado_at) return;
      const d = new Date(p.bonificado_at).getDate();
      if (!dayMap[d]) dayMap[d] = [];
      dayMap[d].push({ ...p, responsible_name: u.name || u.username });
    });
  });

  const cells     = buildCalendar(year, month);
  const today     = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const totalMonth  = visibleByUser.reduce((acc, u) => acc + Number(u.total_value || 0), 0);

  const filteredPending = selUser
    ? pending.filter(p => String(p.responsible_id) === String(selUser))
    : pending;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
    >
      <div style={{
        background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 1100,
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--gray-200)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>

        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--blue-50)', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0, lineHeight: 1.2 }}>
                Calendário de Bonificações
              </h2>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: 0 }}>{MONTHS[month-1]} {year}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* total badge */}
            <div style={{ padding: '8px 16px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total a pagar no mês</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green-600)', lineHeight: 1.2 }}>{fmtMoney(totalMonth)}</div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--gray-100)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-500)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Calendar grid */}
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', borderRight: '1px solid var(--gray-100)' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : (
              <>
                {/* weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 6 }}>
                  {WEEKDAYS.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* day cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                  {cells.map((day, i) => {
                    const hasEvents = day && dayMap[day]?.length > 0;
                    const isToday   = isThisMonth && day === today.getDate();
                    return (
                      <div key={i} style={{
                        minHeight: 80,
                        borderRadius: 10,
                        padding: '8px 8px 6px',
                        background: day ? (isToday ? 'var(--blue-50)' : 'var(--gray-50)') : 'transparent',
                        border: day ? `1px solid ${isToday ? 'var(--blue-100)' : 'var(--gray-100)'}` : 'none',
                        position: 'relative',
                      }}>
                        {day && (
                          <>
                            <div style={{
                              fontSize: 12, fontWeight: isToday ? 700 : 500,
                              color: isToday ? 'var(--blue-600)' : 'var(--gray-500)',
                              marginBottom: 5,
                            }}>
                              {day}
                              {isToday && (
                                <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, background: 'var(--blue-600)', color: 'var(--gray-50)', borderRadius: 20, padding: '1px 5px' }}>hoje</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {(dayMap[day] || []).map((p, pi) => (
                                <div key={pi} style={{
                                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 5,
                                  background: 'var(--green-50)', color: 'var(--green-600)', border: '1px solid var(--green-100)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  cursor: 'default',
                                }} title={`${p.name} — ${fmtMoney(p.approved_value ?? p.suggested_value)}`}>
                                  {fmtMoney(p.approved_value ?? p.suggested_value)}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend for days with events */}
                {Object.keys(dayMap).length > 0 && (
                  <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Bonificações no mês</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {visibleByUser.map(u => {
                        const projects = typeof u.projects === 'string' ? JSON.parse(u.projects) : (u.projects || []);
                        return (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--gray-200)', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                              {(u.name||u.username).split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray-700)' }}>{u.name || u.username}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-600)' }}>{fmtMoney(u.total_value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar — pendentes */}
          <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Pendentes de bonificação
              </div>
              <select
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12, background: 'var(--white)', color: 'var(--gray-700)', fontFamily: 'inherit', cursor: 'pointer' }}
                value={selUser}
                onChange={e => setSelUser(e.target.value)}
              >
                <option value="">Todos os funcionários</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.username}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <div className="spinner" style={{ width: 20, height: 20 }} />
                </div>
              ) : filteredPending.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--gray-400)', fontSize: 13 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Nenhum pendente
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredPending.map(p => (
                    <div key={p.id} style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid var(--amber-100)', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p.responsible_name || '—'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-600)', whiteSpace: 'nowrap' }}>
                          {fmtMoney(p.suggested_value)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* pending total */}
                  <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total pendente</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--amber-600)' }}>
                      {fmtMoney(filteredPending.reduce((a, p) => a + Number(p.suggested_value || 0), 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
