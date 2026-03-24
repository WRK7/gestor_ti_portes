import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './accessToken';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  /** Em dev, Vite faz proxy de /api → back-end (mesma origem do browser; cookies de sessão funcionam). */
  if (import.meta.env.DEV) return '/api';
  const host = window.location.hostname;
  return `http://${host}:3847/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  withCredentials: true,
});

let refreshPromise = null;

const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        const t = res.data.accessToken || res.data.token;
        setAccessToken(t);
        return t;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const url = typeof config?.url === 'string' ? config.url : '';

    if (status !== 401 || !config) {
      return Promise.reject(error);
    }

    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (config._retry) {
      clearAccessToken();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      await refreshAccessToken();
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return api(config);
    } catch {
      clearAccessToken();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }
  }
);

export default api;
