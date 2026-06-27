import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Prevent the interceptor from re-validating during the initial /auth/me fetch
  const initializing = useRef(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => { setLoading(false); initializing.current = false; });
  }, []);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      res => res,
      async (error) => {
        if (initializing.current) return Promise.reject(error);
        const status = error.response?.status;
        if (status === 401) {
          setUser(null);
        } else if (status === 403) {
          // Session may have changed; re-sync React state with the real Flask session
          try {
            const res = await api.get('/auth/me');
            setUser(res.data);
          } catch {
            setUser(null);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const login = (userData) => setUser(userData);
  const logout = () => api.post('/auth/logout').then(() => setUser(null));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
