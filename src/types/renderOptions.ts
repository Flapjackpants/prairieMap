import type { ProjectDisplaySettings, TerritoryDisplayMode } from './displaySettings';

export const RENDER_LAYOUT_LIMITS = {
  mapScale: { min: 0.5, max: 1.0 },
  dossierWidthFraction: { min: 0.1, max: 0.35 },
  dateFontScale: { min: 0.5, max: 2.0 },
  eventLogFontScale: { min: 0.5, max: 2.0 },
  activeDivisionsIconScale: { min: 0.5, max: 2.0 },
} as const;

export interface RenderLayoutOptions {
  mapScale: number;
  dossierWidthFraction: number;
  dateFontScale: number;
  eventLogFontScale: number;
  activeDivisionsIconScale: number;
}

export const DEFAULT_RENDER_LAYOUT: RenderLayoutOptions = {
  mapScale: 1,
  dossierWidthFraction: 0.17,
  dateFontScale: 1,
  eventLogFontScale: 1,
  activeDivisionsIconScale: 1,
};

export function clampRenderLayout(
  raw: Partial<RenderLayoutOptions> | undefined | null,
): RenderLayoutOptions {
  const clamp = (value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  return {
    mapScale: clamp(
      raw?.mapScale,
      RENDER_LAYOUT_LIMITS.mapScale.min,
      RENDER_LAYOUT_LIMITS.mapScale.max,
      DEFAULT_RENDER_LAYOUT.mapScale,
    ),
    dossierWidthFraction: clamp(
      raw?.dossierWidthFraction,
      RENDER_LAYOUT_LIMITS.dossierWidthFraction.min,
      RENDER_LAYOUT_LIMITS.dossierWidthFraction.max,
      DEFAULT_RENDER_LAYOUT.dossierWidthFraction,
    ),
    dateFontScale: clamp(
      raw?.dateFontScale,
      RENDER_LAYOUT_LIMITS.dateFontScale.min,
      RENDER_LAYOUT_LIMITS.dateFontScale.max,
      DEFAULT_RENDER_LAYOUT.dateFontScale,
    ),
    eventLogFontScale: clamp(
      raw?.eventLogFontScale,
      RENDER_LAYOUT_LIMITS.eventLogFontScale.min,
      RENDER_LAYOUT_LIMITS.eventLogFontScale.max,
      DEFAULT_RENDER_LAYOUT.eventLogFontScale,
    ),
    activeDivisionsIconScale: clamp(
      raw?.activeDivisionsIconScale,
      RENDER_LAYOUT_LIMITS.activeDivisionsIconScale.min,
      RENDER_LAYOUT_LIMITS.activeDivisionsIconScale.max,
      DEFAULT_RENDER_LAYOUT.activeDivisionsIconScale,
    ),
  };
}

export interface FrameRenderOptions {
  showBackground: boolean;
  showLabels: boolean;
  territoryDisplayMode: TerritoryDisplayMode;
  showCities: boolean;
  showDivisions: boolean;
  showDossier: boolean;
  showActiveDivisions: boolean;
  layout: RenderLayoutOptions;
  /** null = all countries on the frame */
  visibleCountryIds: string[] | null;
}

export function defaultFrameRenderOptions(
  displaySettings: ProjectDisplaySettings,
  hasDossierContent = false,
): FrameRenderOptions {
  return {
    showBackground: true,
    showLabels: true,
    territoryDisplayMode: displaySettings.territoryDisplayMode,
    showCities: true,
    showDivisions: true,
    showDossier: hasDossierContent,
    showActiveDivisions: true,
    layout: { ...DEFAULT_RENDER_LAYOUT },
    visibleCountryIds: null,
  };
}

export function videoExportRenderOptions(
  displaySettings: ProjectDisplaySettings,
  layout: RenderLayoutOptions = DEFAULT_RENDER_LAYOUT,
): FrameRenderOptions {
  return {
    showBackground: true,
    showLabels: displaySettings.territoryDisplayMode === 'color',
    territoryDisplayMode: displaySettings.territoryDisplayMode,
    showCities: true,
    showDivisions: true,
    showDossier: true,
    showActiveDivisions: true,
    layout,
    visibleCountryIds: null,
  };
}

export function filterCountriesByVisibility<T extends { id: string }>(
  countries: T[],
  visibleCountryIds: string[] | null,
): T[] {
  if (!visibleCountryIds) return countries;
  const allowed = new Set(visibleCountryIds);
  return countries.filter((c) => allowed.has(c.id));
}
