import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchAuthStatus,
  fetchCurrentUser,
  login as apiLogin,
  registerAdmin,
  setAuthToken,
  setUnauthorizedHandler,
} from '../api';

interface AuthContextValue {
  user: string | null;
  loading: boolean;
  setupRequired: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  const persistToken = useCallback((token: string | null) => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    persistToken(null);
  }, [persistToken]);

  const handleUnauthorized = useCallback(() => {
    logout();
    setSetupRequired(false);
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    const stored = localStorage.getItem('authToken');
    if (stored) {
      setAuthToken(stored);
    }
  }, [handleUnauthorized]);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await fetchAuthStatus();
      setSetupRequired(Boolean(status.setup_required));
      const stored = localStorage.getItem('authToken');
      if (stored) {
        try {
          setAuthToken(stored);
          const me = await fetchCurrentUser();
          setUser(me.username);
        } catch {
          logout();
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await apiLogin({ username, password });
      persistToken(result.token);
      setUser(result.username);
      setSetupRequired(false);
    },
    [persistToken],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const result = await registerAdmin({ username, password });
      persistToken(result.token);
      setUser(result.username);
      setSetupRequired(false);
    },
    [persistToken],
  );

  return useMemo(
    () => ({
      user,
      loading,
      setupRequired,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshStatus,
    }),
    [user, loading, setupRequired, login, register, logout, refreshStatus],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
