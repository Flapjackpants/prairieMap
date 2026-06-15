import { TERRITORY_OUTLINE_WIDTH } from './project';

export interface LocalDisplaySettings {
  cityTextSize: number;
  territoryBorderWidth: number;
  cityMarkerStrokeWidth: number;
}

export const LOCAL_DISPLAY_LIMITS = {
  cityTextSize: { min: 6, max: 28 },
  territoryBorderWidth: { min: 0.5, max: 6 },
  cityMarkerStrokeWidth: { min: 0.5, max: 6 },
} as const;

export const DEFAULT_LOCAL_DISPLAY_SETTINGS: LocalDisplaySettings = {
  cityTextSize: 11,
  territoryBorderWidth: TERRITORY_OUTLINE_WIDTH,
  cityMarkerStrokeWidth: 1.5,
};

export const LOCAL_DISPLAY_STORAGE_KEY = 'prairiemap:display';

export function clampLocalDisplaySettings(
  raw: Partial<LocalDisplaySettings>,
): LocalDisplaySettings {
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    cityTextSize: clamp(
      raw.cityTextSize,
      LOCAL_DISPLAY_LIMITS.cityTextSize.min,
      LOCAL_DISPLAY_LIMITS.cityTextSize.max,
      DEFAULT_LOCAL_DISPLAY_SETTINGS.cityTextSize,
    ),
    territoryBorderWidth: clamp(
      raw.territoryBorderWidth,
      LOCAL_DISPLAY_LIMITS.territoryBorderWidth.min,
      LOCAL_DISPLAY_LIMITS.territoryBorderWidth.max,
      DEFAULT_LOCAL_DISPLAY_SETTINGS.territoryBorderWidth,
    ),
    cityMarkerStrokeWidth: clamp(
      raw.cityMarkerStrokeWidth,
      LOCAL_DISPLAY_LIMITS.cityMarkerStrokeWidth.min,
      LOCAL_DISPLAY_LIMITS.cityMarkerStrokeWidth.max,
      DEFAULT_LOCAL_DISPLAY_SETTINGS.cityMarkerStrokeWidth,
    ),
  };
}
