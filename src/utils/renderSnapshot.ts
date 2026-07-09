import type { MapRenderSnapshot } from '../components/canvas/MapRenderStage';
import type { ProjectState } from '../types/project';
import { isBlankAssetKey } from '../types/project';
import type { FrameRenderOptions } from '../types/renderOptions';
import {
  loadImageFromUrl,
  preloadDivisionImages,
  preloadFlagImages,
} from './exportCapture';
import { acquire } from './mapImageCache';
import { computeActiveDivisions, groupDivisionsByIcon } from './activeDivisions';
import { exportDossierMetrics, shouldShowDossierPanel } from './dossierLayout';
import { prepareDossierEventLog } from './formatEventLogExport';
import { resolveTimelineEntry } from './projectHelpers';

export const MAX_EXPORT_DIMENSION = 1920;
export const MAX_PREVIEW_DIMENSION = 480;

export function computeRenderStageDimensions(
  mapWidth: number,
  mapHeight: number,
  maxDimension: number,
) {
  let exportW = mapWidth;
  let exportH = mapHeight;
  const scaleDown = Math.min(1, maxDimension / Math.max(exportW, exportH));
  exportW = Math.round(exportW * scaleDown);
  exportH = Math.round(exportH * scaleDown);
  exportW = Math.max(2, exportW - (exportW % 2));
  exportH = Math.max(2, exportH - (exportH % 2));
  return { exportW, exportH };
}

export function computeStageDimensionsForRender(
  mapWidth: number,
  mapHeight: number,
  maxDimension: number,
  renderOptions?: FrameRenderOptions,
  dossier?: {
    dateTitle: string;
    eventLog: string;
    activeDivisionCount: number;
  },
) {
  const base = computeRenderStageDimensions(mapWidth, mapHeight, maxDimension);
  if (!renderOptions?.showDossier || !dossier) {
    return base;
  }

  const metrics = exportDossierMetrics(base.exportW, base.exportH, renderOptions.layout);
  const eventBody = prepareDossierEventLog(dossier.eventLog, metrics.charsPerLine);
  const showPanel = shouldShowDossierPanel(
    renderOptions.showDossier,
    dossier.dateTitle,
    eventBody,
    renderOptions.showActiveDivisions ? dossier.activeDivisionCount : 0,
  );
  const panelW = showPanel ? metrics.panelW : 0;
  return { exportW: base.exportW + panelW, exportH: base.exportH };
}

export interface RenderSnapshotAssets {
  mapImage: HTMLImageElement | null;
  divisionImages: Record<string, HTMLImageElement>;
  flagImages: Record<string, HTMLImageElement>;
}

export async function loadRenderSnapshotAssets(
  state: ProjectState,
  frameIndex: number,
): Promise<RenderSnapshotAssets | null> {
  const resolved = resolveTimelineEntry(state, frameIndex);
  if (!resolved || resolved.isMissing) return null;

  const divisions = resolved.frameData.annotations.divisions;
  const activeDivisions = computeActiveDivisions(state, frameIndex);
  const allDivisions = [...divisions];
  for (const division of activeDivisions) {
    if (!allDivisions.some((d) => d.id === division.id)) {
      allDivisions.push(division);
    }
  }

  let mapImage: HTMLImageElement | null = null;
  if (!resolved.isBlank && !isBlankAssetKey(resolved.filename)) {
    const file = state.fileRegistry[resolved.filename]?.file;
    if (file) {
      try {
        mapImage = await loadImageFromUrl(acquire(resolved.filename, file));
      } catch {
        mapImage = null;
      }
    }
  }

  const [divisionImages, flagImages] = await Promise.all([
    preloadDivisionImages(state.fileRegistry, allDivisions),
    preloadFlagImages(state.fileRegistry, state.palette),
  ]);

  return { mapImage, divisionImages, flagImages };
}

export function buildRenderSnapshot(
  state: ProjectState,
  frameIndex: number,
  assets: RenderSnapshotAssets,
  maxDimension: number,
  renderOptions?: FrameRenderOptions,
): MapRenderSnapshot | null {
  const resolved = resolveTimelineEntry(state, frameIndex);
  if (!resolved || resolved.isMissing) return null;

  const activeDivisions = computeActiveDivisions(state, frameIndex);
  const activeDivisionCount = renderOptions?.showActiveDivisions
    ? groupDivisionsByIcon(activeDivisions).length
    : 0;

  const { exportW, exportH } = computeStageDimensionsForRender(
    resolved.canvasWidth,
    resolved.canvasHeight,
    maxDimension,
    renderOptions,
    {
      dateTitle: resolved.frameData.info.dateTitle,
      eventLog: resolved.frameData.info.description,
      activeDivisionCount,
    },
  );

  return {
    width: exportW,
    height: exportH,
    mapWidth: resolved.canvasWidth,
    mapHeight: resolved.canvasHeight,
    image: assets.mapImage,
    countries: resolved.frameData.annotations.countries,
    cities: resolved.frameData.annotations.cities,
    divisions: resolved.frameData.annotations.divisions,
    activeDivisions,
    dateTitle: resolved.frameData.info.dateTitle,
    eventLog: resolved.frameData.info.description,
    palette: state.palette,
    displaySettings: state.displaySettings,
    divisionImages: assets.divisionImages,
    flagImages: assets.flagImages,
  };
}
