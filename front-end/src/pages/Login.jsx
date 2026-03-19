import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Preencha usuário e senha');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#111827"/>
              <path d="M8 14h12M14 8l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="login-brand-name">Gestor TI</span>
        </div>
        <div className="login-hero">
          <h1 className="login-hero-title">Gerencie suas tarefas com clareza</h1>
          <p className="login-hero-sub">Organização e produtividade para o time de T.I.</p>
        </div>
        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-icon blue">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="login-feature-title">Tarefas organizadas</p>
              <p className="login-feature-desc">Por status, prioridade e data</p>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon green">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <p className="login-feature-title">Dashboard em tempo real</p>
              <p className="login-feature-desc">Visão completa do dia</p>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon amber">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p className="login-feature-title">Multi-usuário</p>
              <p className="login-feature-desc">Delegação e acompanhamento</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <h2 className="login-form-title">Bem-vindo de volta</h2>
            <p className="login-form-sub">Entre com suas credenciais de acesso</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Usuário</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  className="input"
                  type="text"
                  placeholder="seu.usuario"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Senha</label>
              <div className="input-with-icon">
                <svg className="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  autoComplete="current-password"
                />
                <button type="button" className="input-icon-btn" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="login-footer">
            Gestor de T.I. &mdash; Uso interno
          </p>
        </div>
      </div>

      <style>{`
        .login-page {
          display: flex;
          min-height: 100vh;
          background: var(--white);
        }
        .login-left {
          flex: 1;
          background: #111827;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100vh;
        }
        [data-theme="dark"] .login-left {
          background: #0d1117;
          border-right: 1px solid #30363d;
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .login-brand-name {
          font-size: 16px;
          font-weight: 600;
          color: #f9fafb;
        }
        .login-hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px 0;
        }
        .login-hero-title {
          font-size: 36px;
          font-weight: 700;
          color: #f9fafb;
          line-height: 1.2;
          margin-bottom: 16px;
          letter-spacing: -0.5px;
        }
        .login-hero-sub {
          font-size: 16px;
          color: #9ca3af;
          line-height: 1.6;
        }
        .login-features {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .login-feature {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .login-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .login-feature-icon.blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
        .login-feature-icon.green { background: rgba(34,197,94,0.2); color: #4ade80; }
        .login-feature-icon.amber { background: rgba(245,158,11,0.2); color: #fbbf24; }
        .login-feature-title {
          font-size: 13px;
          font-weight: 500;
          color: #f9fafb;
        }
        .login-feature-desc {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 1px;
        }
        .login-right {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: var(--white);
        }
        .login-form-wrapper {
          width: 100%;
          max-width: 360px;
        }
        .login-form-header {
          margin-bottom: 32px;
        }
        .login-form-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--gray-900);
          margin-bottom: 6px;
          letter-spacing: -0.3px;
        }
        .login-form-sub {
          font-size: 14px;
          color: var(--gray-500);
        }
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          background: var(--red-50);
          border: 1px solid var(--red-100);
          border-radius: var(--radius-sm);
          color: var(--red-600);
          font-size: 13px;
          margin-bottom: 16px;
        }
        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-icon .input-icon {
          position: absolute;
          left: 12px;
          color: var(--gray-400);
          pointer-events: none;
          z-index: 1;
        }
        .input-with-icon .input {
          padding-left: 38px;
        }
        .input-icon-btn {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-400);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
        }
        .input-icon-btn:hover { color: var(--gray-600); }
        .login-footer {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: var(--gray-400);
        }
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right { width: 100%; padding: 32px 24px; }
        }
      `}</style>
    </div>
  );
}
