import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCAL_DISPLAY_SETTINGS,
  LOCAL_DISPLAY_STORAGE_KEY,
} from '../types/localDisplaySettings';
import {
  loadLocalDisplaySettings,
  saveLocalDisplaySettings,
} from './localDisplaySettingsStorage';

describe('localDisplaySettingsStorage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadLocalDisplaySettings()).toEqual(DEFAULT_LOCAL_DISPLAY_SETTINGS);
  });

  it('merges and clamps stored values', () => {
    saveLocalDisplaySettings({
      cityTextSize: 99,
      territoryBorderWidth: 0.1,
      cityMarkerStrokeWidth: 3,
    });
    expect(loadLocalDisplaySettings()).toEqual({
      cityTextSize: 28,
      territoryBorderWidth: 0.5,
      cityMarkerStrokeWidth: 3,
    });
  });

  it('falls back to defaults for invalid JSON', () => {
    store.set(LOCAL_DISPLAY_STORAGE_KEY, '{not json');
    expect(loadLocalDisplaySettings()).toEqual(DEFAULT_LOCAL_DISPLAY_SETTINGS);
  });
});
