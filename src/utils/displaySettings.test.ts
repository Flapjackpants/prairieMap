import { describe, expect, it } from 'vitest';
import {
  clampDisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
} from '../types/displaySettings';

describe('clampDisplaySettings', () => {
  it('returns defaults for empty input', () => {
    expect(clampDisplaySettings(undefined)).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it('clamps out-of-range values', () => {
    expect(
      clampDisplaySettings({
        cityTextSize: 99,
        territoryBorderWidth: 0.1,
        cityMarkerStrokeWidth: 3,
      }),
    ).toEqual({
      cityTextSize: 28,
      territoryBorderWidth: 0.5,
      cityMarkerStrokeWidth: 3,
      territoryDisplayMode: 'color',
      syncEventLogsByDate: false,
    });
  });

  it('reads the syncEventLogsByDate flag', () => {
    expect(clampDisplaySettings({ syncEventLogsByDate: true }).syncEventLogsByDate).toBe(true);
    expect(clampDisplaySettings({}).syncEventLogsByDate).toBe(false);
  });

  it('accepts flag display mode', () => {
    expect(clampDisplaySettings({ territoryDisplayMode: 'flag' }).territoryDisplayMode).toBe(
      'flag',
    );
  });
});
