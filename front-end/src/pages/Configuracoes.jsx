import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const settingsCards = [
  {
    to: '/configuracoes/usuarios',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    label: 'Usuários',
    description: 'Gerencie contas, permissões e acesso ao sistema.',
    color: 'var(--blue-600)',
    bg: 'var(--blue-50)',
  },
  {
    to: '/configuracoes/sobre',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
    label: 'Sobre & Tutorial',
    description: 'Guia de uso do sistema e informações sobre o projeto.',
    color: 'var(--gray-600)',
    bg: 'var(--gray-50)',
  },
];

export default function Configuracoes() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const themeCardColor = theme === 'light' ? '#6366f1' : '#f59e0b';
  const themeCardBg = theme === 'light' ? '#eef2ff' : '#fffbeb';

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Configurações</h1>
          <p className="dashboard-date">Administração do sistema</p>
        </div>
      </div>

      <div className="settings-grid">
        <button
          type="button"
          className="settings-card"
          onClick={toggleTheme}
          style={{ '--card-color': themeCardColor, '--card-bg': themeCardBg }}
        >
          <div className="settings-card-icon">
            {theme === 'light' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </div>
          <div className="settings-card-body">
            <h3 className="settings-card-label">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</h3>
            <p className="settings-card-desc">
              {theme === 'light'
                ? 'Alternar para o tema escuro, mais confortável em ambientes com pouca luz.'
                : 'Alternar para o tema claro, ideal para ambientes bem iluminados.'}
            </p>
          </div>
          <div className="settings-card-trail">
            <div className={`theme-switch-track ${theme === 'dark' ? 'active' : ''}`}>
              <div className="theme-switch-thumb" />
            </div>
          </div>
        </button>

        {settingsCards.map((card) => (
          <button
            type="button"
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
            <div className="settings-card-trail">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="settings-card-arrow">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
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
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) 44px;
          align-items: center;
          column-gap: 16px;
          padding: 18px 20px;
          box-sizing: border-box;
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
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--card-bg);
          color: var(--card-color);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-card-trail {
          width: 44px;
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

        .theme-switch-track {
          width: 44px;
          height: 24px;
          border-radius: 12px;
          background: var(--gray-200);
          position: relative;
          transition: background 0.25s;
        }
        .theme-switch-track.active {
          background: var(--primary);
        }
        .theme-switch-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--white);
          position: absolute;
          top: 3px;
          left: 3px;
          transition: transform 0.25s;
          box-shadow: 0 1px 3px rgba(0,0,0,.15);
        }
        .theme-switch-track.active .theme-switch-thumb {
          transform: translateX(20px);
        }
      `}</style>
    </div>
  );
}
