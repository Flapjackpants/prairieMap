import {
  clampLocalDisplaySettings,
  DEFAULT_LOCAL_DISPLAY_SETTINGS,
  LOCAL_DISPLAY_STORAGE_KEY,
  type LocalDisplaySettings,
} from '../types/localDisplaySettings';

export function loadLocalDisplaySettings(): LocalDisplaySettings {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_LOCAL_DISPLAY_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(LOCAL_DISPLAY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LOCAL_DISPLAY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<LocalDisplaySettings>;
    return clampLocalDisplaySettings(parsed);
  } catch {
    return { ...DEFAULT_LOCAL_DISPLAY_SETTINGS };
  }
}

export function saveLocalDisplaySettings(settings: LocalDisplaySettings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCAL_DISPLAY_STORAGE_KEY, JSON.stringify(settings));
}
