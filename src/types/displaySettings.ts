import { TERRITORY_OUTLINE_WIDTH } from './project';

export type TerritoryDisplayMode = 'color' | 'flag';

export interface ProjectDisplaySettings {
  cityTextSize: number;
  territoryBorderWidth: number;
  cityMarkerStrokeWidth: number;
  territoryDisplayMode: TerritoryDisplayMode;
  syncEventLogsByDate: boolean;
}

export const DISPLAY_SETTINGS_LIMITS = {
  cityTextSize: { min: 6, max: 28 },
  territoryBorderWidth: { min: 0.5, max: 6 },
  cityMarkerStrokeWidth: { min: 0.5, max: 6 },
} as const;

export const DEFAULT_DISPLAY_SETTINGS: ProjectDisplaySettings = {
  cityTextSize: 11,
  territoryBorderWidth: TERRITORY_OUTLINE_WIDTH,
  cityMarkerStrokeWidth: 1.5,
  territoryDisplayMode: 'color',
  syncEventLogsByDate: false,
};

export function clampDisplaySettings(
  raw: Partial<ProjectDisplaySettings> | undefined | null,
): ProjectDisplaySettings {
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    cityTextSize: clamp(
      raw?.cityTextSize,
      DISPLAY_SETTINGS_LIMITS.cityTextSize.min,
      DISPLAY_SETTINGS_LIMITS.cityTextSize.max,
      DEFAULT_DISPLAY_SETTINGS.cityTextSize,
    ),
    territoryBorderWidth: clamp(
      raw?.territoryBorderWidth,
      DISPLAY_SETTINGS_LIMITS.territoryBorderWidth.min,
      DISPLAY_SETTINGS_LIMITS.territoryBorderWidth.max,
      DEFAULT_DISPLAY_SETTINGS.territoryBorderWidth,
    ),
    cityMarkerStrokeWidth: clamp(
      raw?.cityMarkerStrokeWidth,
      DISPLAY_SETTINGS_LIMITS.cityMarkerStrokeWidth.min,
      DISPLAY_SETTINGS_LIMITS.cityMarkerStrokeWidth.max,
      DEFAULT_DISPLAY_SETTINGS.cityMarkerStrokeWidth,
    ),
    territoryDisplayMode:
      raw?.territoryDisplayMode === 'flag' ? 'flag' : DEFAULT_DISPLAY_SETTINGS.territoryDisplayMode,
    syncEventLogsByDate: Boolean(raw?.syncEventLogsByDate),
  };
}
