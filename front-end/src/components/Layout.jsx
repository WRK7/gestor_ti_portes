import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const ORIGINAL_FAVICON = '/favicon.svg';

function drawFaviconBadge(count) {
  const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
  link.rel = 'icon';

  if (!count) {
    link.href = ORIGINAL_FAVICON;
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
    document.title = 'Gestor TI';
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 64, 64);

    const label = count > 99 ? '99+' : String(count);
    const badgeW = Math.max(28, ctx.measureText(label).width + 14);
    const badgeH = 26;
    const bx = 64 - badgeW;
    const by = 0;

    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, badgeH, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2 + 1);

    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
    document.head.appendChild(link);
  };
  img.src = ORIGINAL_FAVICON;

  document.title = `(${count > 99 ? '99+' : count}) Gestor TI`;
}

function requestNativeNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

const NOTIF_SOUND_URL = 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICAgICAgICA' +
  'f3h0cXBvcHJ1eX+Fi5CUlpeXlpKOiIN+eXVyb29wc3d8goiNkZSWl5eWko6Ig3x3c3Bvb3F1eoGHjJGVl5iX' +
  'lZGMhn95dHBub3Byd3yChoyRlZeYl5WRjIaDfXh0cXBvcHN3fIKHjJCUlpeXlZKOiYR+eXVycHBxdHl+g4iM' +
  'kJOWl5eVko6JhH55dXJwcHF0eX6DiIyQk5aXl5WSjoqFgHt3c3FwcXR4fYKHi4+Sk5aWlpSSjomFgHt3dHFw' +
  'cXR4fYKHi4+SlZaWlZKOiYWAfHh0cnBxdHh9goaLj5KVlpaVko+KhYF8eHRycXF0eH2ChoqOkpWWlpWTj4qG' +
  'gXx4dHJxcXR4fIGGio6SlJWWlpOPi4aBfXl1cnFxdHh8gYaKjpGUlZaVk4+LhoJ9eXVzcXF0eHyBhoqOkZSV' +
  'lpWTj4uGgn15dXNxcnR4fIGFiY2RlJWVlZOQi4eCfnp2c3FydHh8gYWJjZCTlZWVk5CLh4J+enZ0cnJ0eHuA' +
  'hYmNkJOUlZWTkIuHg356d3RycnR3e4CFiY2QkpSVlJOQjIiDf3t3dHJydHd7gIWJjI+Sk5SUk5CMiIN/e3d0' +
  'c3J0d3uAhIiMj5KTlJSTkIyIhIB8eHV0c3R3e3+EiIuOkZOUlJOQjIiEgHx4dXRzdHd7f4SHi46RkpOUk5CM' +
  'iISAfHl2dHN0d3p/g4eLjo+Sk5OTkY2JhYF9eXZ0dHR3en+DhwuOj5GTk5ORjYmFgX16d3V0dHd6fv8=';

let _notifAudio = null;
function getNotifAudio() {
  if (!_notifAudio) {
    _notifAudio = new Audio(NOTIF_SOUND_URL);
    _notifAudio.volume = 0.5;
  }
  return _notifAudio;
}

function playNotifSound() {
  try {
    const a = getNotifAudio();
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (_) {}
}

function showNativeNotification(title, body) {
  playNotifSound();

  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: ORIGINAL_FAVICON,
      tag: `gestor-ti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requireInteraction: true,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (_) { /* mobile / insecure context */ }
}

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
    to: '/modo-gestor',
    label: 'Modo Gestor',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    managerOnly: true,
  },
  {
    to: '/billing',
    label: 'Billing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
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
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const isManagerRole = (role) => ['gestor', 'admin', 'superadmin'].includes(role);

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const prevUnreadRef = useRef(0);
  const lastSeenIdRef = useRef(0);

  const fetchUnread = useCallback(() => {
    api.get('/notifications/unread-count').then(r => {
      const newCount = r.data.count;
      setUnreadCount(newCount);

      if (newCount > prevUnreadRef.current) {
        api.get('/notifications').then(nr => {
          const fresh = nr.data;
          setNotifs(fresh);
          const newOnes = fresh.filter(n => !n.is_read && n.id > lastSeenIdRef.current);
          if (newOnes.length && lastSeenIdRef.current > 0) {
            newOnes.forEach(n => showNativeNotification(n.title, n.message));
          }
          if (fresh.length) lastSeenIdRef.current = Math.max(...fresh.map(n => n.id));
        }).catch(() => {});
      }

      prevUnreadRef.current = newCount;
    }).catch(() => {});
  }, []);

  const fetchNotifs = useCallback(() => {
    api.get('/notifications').then(r => {
      setNotifs(r.data);
      if (r.data.length) lastSeenIdRef.current = Math.max(...r.data.map(n => n.id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    requestNativeNotifPermission();
    fetchUnread();
    const id = setInterval(fetchUnread, 15000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    drawFaviconBadge(unreadCount);
    return () => {
      drawFaviconBadge(0);
    };
  }, [unreadCount]);

  useEffect(() => {
    if (!showNotifs) return;
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifs]);

  const handleBellClick = () => {
    if (!showNotifs) fetchNotifs();
    setShowNotifs(p => !p);
  };

  const handleMarkRead = async (id) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(p => Math.max(0, p - 1));
  };

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifs(p => p.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) handleMarkRead(notif.id);
    if (notif.link) navigate(notif.link);
    setShowNotifs(false);
  };

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

        {/* Notifications bell */}
        <div className="sidebar-notif-area" ref={notifRef}>
          <button className="sidebar-notif-btn" onClick={handleBellClick} title="Notificações">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Notificações</span>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifs && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <span className="notif-dropdown-title">Notificações</span>
                {unreadCount > 0 && (
                  <button className="notif-read-all" onClick={handleMarkAllRead}>Marcar todas como lidas</button>
                )}
              </div>
              <div className="notif-dropdown-list">
                {notifs.length === 0 ? (
                  <div className="notif-empty">Sem notificações</div>
                ) : notifs.map(n => (
                  <button
                    key={n.id}
                    className={`notif-item${n.is_read ? '' : ' notif-unread'}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="notif-dot-col">
                      {!n.is_read && <span className="notif-dot" />}
                    </div>
                    <div className="notif-content">
                      <p className="notif-item-title">{n.title}</p>
                      <p className="notif-item-msg">{n.message}</p>
                      <p className="notif-item-time">{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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

        /* Notification bell */
        .sidebar-notif-area {
          position: relative;
          padding: 4px 12px;
        }
        .sidebar-notif-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--gray-500);
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s;
          position: relative;
        }
        .sidebar-notif-btn:hover {
          background: var(--gray-50);
          color: var(--gray-700);
        }
        .notif-badge {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          border-radius: 10px;
          background: var(--red-500);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 0 5px;
        }

        /* Dropdown */
        .notif-dropdown {
          position: absolute;
          left: calc(100% + 8px);
          bottom: 0;
          width: 340px;
          max-height: 440px;
          background: var(--white);
          border: 1px solid var(--gray-200);
          border-radius: 12px;
          box-shadow: var(--shadow-xl);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .notif-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--gray-100);
        }
        .notif-dropdown-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--gray-900);
        }
        .notif-read-all {
          font-size: 11px;
          font-weight: 600;
          color: var(--blue-600);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .notif-read-all:hover { text-decoration: underline; }
        .notif-dropdown-list {
          overflow-y: auto;
          flex: 1;
        }
        .notif-empty {
          padding: 32px;
          text-align: center;
          color: var(--gray-400);
          font-size: 13px;
        }
        .notif-item {
          display: flex;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-bottom: 1px solid var(--gray-50);
          background: none;
          width: 100%;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }
        .notif-item:hover { background: var(--gray-50); }
        .notif-unread { background: var(--blue-50); }
        .notif-unread:hover { background: var(--blue-100); }
        .notif-dot-col {
          width: 8px;
          padding-top: 6px;
          flex-shrink: 0;
        }
        .notif-dot {
          display: block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--blue-500);
        }
        .notif-content { flex: 1; min-width: 0; }
        .notif-item-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--gray-900);
          margin: 0 0 2px;
        }
        .notif-item-msg {
          font-size: 12px;
          color: var(--gray-500);
          margin: 0 0 4px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .notif-item-time {
          font-size: 10px;
          color: var(--gray-400);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
