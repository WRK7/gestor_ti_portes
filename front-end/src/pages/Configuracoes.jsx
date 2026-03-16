import { useNavigate } from 'react-router-dom';

const settingsCards = [
  {
    to: '/configuracoes/usuarios',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: 'Usuários',
    description: 'Gerencie contas, permissões e acesso ao sistema.',
    color: '#2563eb',
    bg: '#eff6ff',
  },
];

export default function Configuracoes() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Configurações</h1>
          <p className="dashboard-date">Administração do sistema</p>
        </div>
      </div>

      <div className="settings-grid">
        {settingsCards.map((card) => (
          <button
            key={card.to}
            className="settings-card"
            onClick={() => navigate(card.to)}
            style={{ '--card-color': card.color, '--card-bg': card.bg }}
          >
            <div className="settings-card-icon">{card.icon}</div>
            <div className="settings-card-body">
              <h3 className="settings-card-label">{card.label}</h3>
              <p className="settings-card-desc">{card.description}</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="settings-card-arrow">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>

      <style>{`
        .dashboard { padding: 28px 32px; width: 100%; }
        .dashboard-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; }
        .dashboard-title { font-size: 22px; font-weight: 700; color: var(--gray-900); letter-spacing: -0.3px; }
        .dashboard-date { font-size: 13px; color: var(--gray-400); margin-top: 2px; }

        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 600px;
        }
        .settings-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 20px 22px;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition);
          box-shadow: var(--shadow-sm);
          width: 100%;
        }
        .settings-card:hover {
          border-color: var(--card-color);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--card-color) 10%, transparent);
          transform: translateY(-1px);
        }
        .settings-card-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: var(--card-bg);
          color: var(--card-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .settings-card-body { flex: 1; min-width: 0; }
        .settings-card-label {
          font-size: 15px;
          font-weight: 600;
          color: var(--gray-900);
          margin-bottom: 3px;
        }
        .settings-card-desc {
          font-size: 13px;
          color: var(--gray-500);
          line-height: 1.4;
        }
        .settings-card-arrow {
          color: var(--gray-300);
          flex-shrink: 0;
          transition: all var(--transition);
        }
        .settings-card:hover .settings-card-arrow {
          color: var(--card-color);
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
}
