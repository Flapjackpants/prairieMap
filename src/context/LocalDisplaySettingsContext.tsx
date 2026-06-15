import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clampLocalDisplaySettings,
  DEFAULT_LOCAL_DISPLAY_SETTINGS,
  type LocalDisplaySettings,
} from '../types/localDisplaySettings';
import {
  loadLocalDisplaySettings,
  saveLocalDisplaySettings,
} from '../utils/localDisplaySettingsStorage';

interface LocalDisplaySettingsContextValue {
  settings: LocalDisplaySettings;
  updateSettings: (patch: Partial<LocalDisplaySettings>) => void;
  resetSettings: () => void;
}

const LocalDisplaySettingsContext = createContext<LocalDisplaySettingsContextValue | null>(
  null,
);

export function LocalDisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<LocalDisplaySettings>(() =>
    loadLocalDisplaySettings(),
  );

  const updateSettings = useCallback((patch: Partial<LocalDisplaySettings>) => {
    setSettings((prev) => {
      const next = clampLocalDisplaySettings({ ...prev, ...patch });
      saveLocalDisplaySettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_LOCAL_DISPLAY_SETTINGS };
    saveLocalDisplaySettings(next);
    setSettings(next);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  );

  return (
    <LocalDisplaySettingsContext.Provider value={value}>
      {children}
    </LocalDisplaySettingsContext.Provider>
  );
}

export function useLocalDisplaySettings(): LocalDisplaySettingsContextValue {
  const ctx = useContext(LocalDisplaySettingsContext);
  if (!ctx) {
    throw new Error('useLocalDisplaySettings must be used within LocalDisplaySettingsProvider');
  }
  return ctx;
}
