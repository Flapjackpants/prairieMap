import type { ProjectDisplaySettings, TerritoryDisplayMode } from './displaySettings';

export interface FrameRenderOptions {
  showBackground: boolean;
  showLabels: boolean;
  territoryDisplayMode: TerritoryDisplayMode;
  showCities: boolean;
  showDivisions: boolean;
  showDossier: boolean;
  /** null = all countries on the frame */
  visibleCountryIds: string[] | null;
}

export function defaultFrameRenderOptions(
  displaySettings: ProjectDisplaySettings,
): FrameRenderOptions {
  return {
    showBackground: true,
    showLabels: true,
    territoryDisplayMode: displaySettings.territoryDisplayMode,
    showCities: true,
    showDivisions: true,
    showDossier: false,
    visibleCountryIds: null,
  };
}

export function videoExportRenderOptions(
  displaySettings: ProjectDisplaySettings,
): FrameRenderOptions {
  return {
    showBackground: true,
    showLabels: displaySettings.territoryDisplayMode === 'color',
    territoryDisplayMode: displaySettings.territoryDisplayMode,
    showCities: true,
    showDivisions: true,
    showDossier: true,
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
