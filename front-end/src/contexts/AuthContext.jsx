import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { setAccessToken, clearAccessToken } from '../services/accessToken';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem('token');

    (async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (cancelled) return;
        const t = data.accessToken || data.token;
        setAccessToken(t);
        const { data: me } = await api.get('/auth/me');
        if (!cancelled) {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
        }
      } catch {
        clearAccessToken();
        localStorage.removeItem('user');
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    const t = data.accessToken || data.token;
    setAccessToken(t);
    localStorage.removeItem('token');
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    clearAccessToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
