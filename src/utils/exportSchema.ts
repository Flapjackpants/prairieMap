import type {
  AssetFrameState,
  CountryTerritory,
  FrameAnnotations,
  LegacyDrawingsExport,
  ProjectExport,
  ProjectExportV1,
  ProjectExportV2,
  ProjectState,
  TerritoryDrawings,
  TimelineEntry,
} from '../types/project';
import { v4 as uuidv4 } from 'uuid';
import { createEmptyAssetState } from '../types/project';
import { recomputeCountryLabels } from './territoryGeometry';

function normalizeCountry(country: CountryTerritory): CountryTerritory {
  if (!country.regionLabels?.length && country.regions.length > 0) {
    return recomputeCountryLabels({
      ...country,
      regionLabels: country.regionLabels ?? [],
    });
  }
  if (!country.regionLabels) {
    return { ...country, regionLabels: [] };
  }
  return country;
}

function assetStateToExport(state: AssetFrameState): ProjectExportV2['assets'][string][number] {
  return {
    drawings: { countries: state.annotations.countries },
    infoBoard: {
      date: state.info.dateTitle,
      text: state.info.description,
      factionStats: state.info.factionStats,
    },
  };
}

function normalizeDrawings(drawings: TerritoryDrawings | LegacyDrawingsExport): FrameAnnotations {
  if (drawings && 'countries' in drawings && Array.isArray(drawings.countries)) {
    return {
      countries: (drawings.countries as CountryTerritory[]).map(normalizeCountry),
    };
  }
  return { countries: [] };
}

function exportToAssetState(entry: ProjectExportV2['assets'][string][number]): AssetFrameState {
  const drawings = entry.drawings;
  return {
    annotations: normalizeDrawings(drawings),
    info: {
      dateTitle: entry.infoBoard?.date ?? '',
      description: entry.infoBoard?.text ?? '',
      factionStats: entry.infoBoard?.factionStats ?? [],
    },
  };
}

export function stateToExport(state: ProjectState): ProjectExportV2 {
  const assets: ProjectExportV2['assets'] = {};
  for (const [filename, copies] of Object.entries(state.assets)) {
    assets[filename] = copies.map(assetStateToExport);
  }

  return {
    version: 2,
    projectName: state.projectName,
    exportedAt: new Date().toISOString(),
    palette: state.palette,
    carryOverLabels: state.carryOverLabels,
    assets,
    timeline: state.timeline.map((t) => ({ ...t })),
  };
}

export function isV2Export(data: ProjectExport): data is ProjectExportV2 {
  return data.version === 2;
}

export function isV1Export(data: ProjectExport): data is ProjectExportV1 {
  return data.version === 1;
}

export function migrateV1ToAssets(data: ProjectExportV1): {
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
} {
  const assets: Record<string, AssetFrameState[]> = {};
  const timeline: TimelineEntry[] = [];

  for (const frame of data.frames) {
    const state: AssetFrameState = {
      annotations: {
        countries: (frame.annotations?.countries ?? []).map((c) =>
          normalizeCountry({ ...c, regionLabels: c.regionLabels ?? [] }),
        ),
      },
      info: frame.info,
    };
    if (!assets[frame.filename]) assets[frame.filename] = [];
    const copyIndex = assets[frame.filename].length;
    assets[frame.filename].push(state);
    timeline.push({
      id: uuidv4(),
      filename: frame.filename,
      copyIndex,
    });
  }

  return { assets, timeline };
}

export function importToAssets(data: ProjectExport): {
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
  projectName: string;
  palette: ProjectExportV2['palette'];
  carryOverLabels: boolean;
} {
  if (isV2Export(data)) {
    const assets: Record<string, AssetFrameState[]> = {};
    for (const [filename, copies] of Object.entries(data.assets)) {
      assets[filename] = copies.map(exportToAssetState);
    }
    return {
      assets,
      timeline: data.timeline.map((t) => ({ ...t })),
      projectName: data.projectName,
      palette: data.palette,
      carryOverLabels: data.carryOverLabels,
    };
  }

  const migrated = migrateV1ToAssets(data);
  return {
    ...migrated,
    projectName: 'Imported Project',
    palette: data.palette,
    carryOverLabels: data.carryOverLabels,
  };
}

export function createInitialAssetsFromFiles(
  filenames: string[],
): Record<string, AssetFrameState[]> {
  const assets: Record<string, AssetFrameState[]> = {};
  for (const filename of filenames) {
    assets[filename] = [createEmptyAssetState()];
  }
  return assets;
}

export function createTimelineFromFiles(filenames: string[]): TimelineEntry[] {
  return filenames.map((filename) => ({
    id: uuidv4(),
    filename,
    copyIndex: 0,
  }));
}
