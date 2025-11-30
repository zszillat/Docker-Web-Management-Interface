import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchConfigSettings, updateConfigSettings } from '../api';
import { AppConfig } from '../types';
import { useAuth } from './AuthContext';

interface ConfigContextValue {
  config: AppConfig | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfig: (payload: Partial<AppConfig>) => Promise<AppConfig>;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

function applyTheme(theme: string | undefined) {
  document.body.classList.toggle('theme-dark', theme === 'dark');
}

function useProvideConfig(): ConfigContextValue {
  const { isAuthenticated } = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshConfig = useCallback(async () => {
    if (!isAuthenticated) {
      setConfig(null);
      applyTheme('light');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchConfigSettings();
      setConfig(data);
      applyTheme(data.theme);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const saveConfig = useCallback(
    async (payload: Partial<AppConfig>) => {
      const updated = await updateConfigSettings(payload);
      setConfig(updated);
      applyTheme(updated.theme);
      return updated;
    },
    [],
  );

  return useMemo(
    () => ({ config, loading, refreshConfig, updateConfig: saveConfig }),
    [config, loading, refreshConfig, saveConfig],
  );
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const value = useProvideConfig();
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
}
