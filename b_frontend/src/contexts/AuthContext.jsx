import { createContext, useCallback, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY   = 'ff_token';
const REFRESH_KEY = 'ff_refresh_token';
const USER_KEY    = 'ff_user';

// Injeta o token imediatamente (síncrono) antes de qualquer render
const _storedToken = localStorage.getItem(TOKEN_KEY);
if (_storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${_storedToken}`;
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const _persist = (userData, accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      _persist(data.user, data.access_token, data.refresh_token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.response?.data?.detail || 'Erro ao fazer login.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/register', { username, email, password });
      // Não persiste ainda — deixa o componente exibir a mensagem de sucesso antes
      return { success: true, user: data.user, token: data.access_token, refreshToken: data.refresh_token };
    } catch (err) {
      return { success: false, error: err?.response?.data?.detail || 'Erro ao cadastrar.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmAuth = useCallback((userData, accessToken, refreshToken) => {
    _persist(userData, accessToken, refreshToken);
  }, []);

  const updateUser = useCallback((userData, accessToken, refreshToken) => {
    _persist(userData, accessToken, refreshToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, confirmAuth, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
