import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to: '/bonificacao',
    label: 'Bonificação',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    to: '/logs',
    label: 'Logs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    managerOnly: true,
  },
  {
    to: '/modo-gestor',
    label: 'Modo Gestor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    managerOnly: true,
  },
];

const isManagerRole = (role) => ['gestor', 'admin'].includes(role);

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#111827"/>
              <path d="M8 14h12M14 8l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">Gestor TI</span>
            <span className="sidebar-brand-sub">Portal Interno</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">Menu</p>
          {navItems
            .filter(item => !item.managerOnly || isManagerRole(user?.role))
            .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to !== '/configuracoes'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-theme">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
            <span>{theme === 'light' ? 'Modo escuro' : 'Modo claro'}</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => setShowUserMenu(p => !p)}>
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{user?.name || user?.username}</p>
              <p className="sidebar-user-role">{user?.role || 'Usuário'}</p>
            </div>
            <button
              className="sidebar-logout"
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              title="Sair"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: var(--sidebar-width);
          background: var(--white);
          border-right: 1px solid var(--gray-200);
          display: flex;
          flex-direction: column;
          z-index: 100;
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 16px;
          border-bottom: 1px solid var(--gray-100);
        }
        .sidebar-brand-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--gray-900);
          line-height: 1.2;
        }
        .sidebar-brand-sub {
          font-size: 11px;
          color: var(--gray-400);
        }
        .sidebar-nav {
          flex: 1;
          padding: 16px 10px;
          overflow-y: auto;
        }
        .sidebar-nav-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--gray-400);
          padding: 0 6px;
          margin-bottom: 6px;
          margin-top: 4px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: var(--radius-sm);
          color: var(--gray-600);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 500;
          transition: all var(--transition);
          margin-bottom: 2px;
          position: relative;
        }
        .sidebar-link:hover:not(.soon) {
          background: var(--gray-100);
          color: var(--gray-900);
        }
        .sidebar-link.active {
          background: var(--gray-900);
          color: var(--white);
        }
        .sidebar-link.soon {
          opacity: 0.5;
          cursor: default;
        }
        .sidebar-link-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .sidebar-link-label { flex: 1; }
        .sidebar-soon {
          font-size: 10px;
          font-weight: 500;
          background: var(--gray-100);
          color: var(--gray-500);
          padding: 1px 6px;
          border-radius: 10px;
        }
        .sidebar-link.active .sidebar-soon {
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
        }
        .sidebar-theme {
          padding: 8px 12px;
        }
        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--gray-500);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition);
        }
        .theme-toggle:hover {
          background: var(--gray-100);
          color: var(--gray-900);
        }
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid var(--gray-100);
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background var(--transition);
        }
        .sidebar-user:hover { background: var(--gray-50); }
        .sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: var(--gray-900);
          color: var(--white);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-user-info { flex: 1; min-width: 0; }
        .sidebar-user-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-role {
          font-size: 11px;
          color: var(--gray-400);
          text-transform: capitalize;
        }
        .sidebar-logout {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-400);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: all var(--transition);
          flex-shrink: 0;
        }
        .sidebar-logout:hover {
          background: var(--red-50);
          color: var(--red-500);
        }
      `}</style>
    </div>
  );
}
