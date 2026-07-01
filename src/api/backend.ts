import type { FrameDuplicateOptions, FactionStat, PolygonRing } from '../types/project';
import type { ProjectBody } from '../types/projectBody';
import { apiFetch } from './client';

export interface ProjectMutationResponse {
  project: ProjectBody;
  projectId?: string;
}

export interface ProjectMeta {
  id: string;
  projectName: string;
}

export async function createProject(body?: ProjectBody): Promise<ProjectMutationResponse> {
  return apiFetch('/projects', {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function getProject(id: string): Promise<ProjectBody> {
  return apiFetch(`/projects/${id}`);
}

export async function saveProject(id: string, body: ProjectBody): Promise<ProjectMutationResponse> {
  return apiFetch(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function importProject(data: unknown): Promise<ProjectMutationResponse> {
  return apiFetch('/projects/import', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export async function exportProject(id: string): Promise<unknown> {
  return apiFetch(`/projects/${id}/export`);
}

export async function addTerritoryRegion(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  factionId: string;
  factionName: string;
  color: string;
  region: PolygonRing;
  targetCountryId?: string | null;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/add-region', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function deleteCountry(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  countryId: string;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/delete-country', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateFactionMetadata(params: {
  project: ProjectBody;
  factionId: string;
  name?: string;
  hex?: string;
  flagFilename?: string | null;
  setFlag?: boolean;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/update-faction-metadata', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function addPaletteColor(params: {
  project: ProjectBody;
  name: string;
  hex: string;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/add-palette-color', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function claimAnchor(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  countryId: string;
  x: number;
  y: number;
  epsilon?: number;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/claim-anchor', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function removeTerritoryVertex(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  countryId: string;
  ringIndex: number;
  vertexIndex: number;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/remove-vertex', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function upsertMarkers(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  cities: import('../types/project').CityMarker[];
  divisions: import('../types/project').DivisionMarker[];
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/upsert-markers', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export type DivisionIconScope = 'current_frame' | 'all_frames';

export type RemoveDivisionScope = 'current_frame' | 'current_and_future';

export async function updateDivisionIcon(params: {
  project: ProjectBody;
  divisionId: string;
  patch: {
    name?: string;
    sourceFilename?: string;
    crop?: import('../types/project').DivisionCropRect;
    size?: number;
  };
  scope?: DivisionIconScope;
  target?: { filename: string; copyIndex: number };
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/update-division-icon', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function removeDivision(params: {
  project: ProjectBody;
  divisionId: string;
  scope?: RemoveDivisionScope;
  target?: { filename: string; copyIndex: number };
  fromTimelineIndex?: number;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/remove-division', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function pasteTerritory(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  sourceTimelineIndex: number;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/paste-territory', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function moveTerritoryVertex(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  countryId: string;
  ringIndex: number;
  vertexIndex: number;
  x: number;
  y: number;
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/move-vertex', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateFrameInfo(params: {
  project: ProjectBody;
  target: { filename: string; copyIndex: number };
  dateTitle?: string;
  description?: string;
  factionStats?: FactionStat[];
}): Promise<ProjectMutationResponse> {
  return apiFetch('/geometry/update-frame-info', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function setTimelineIndex(
  project: ProjectBody,
  index: number,
): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/set-index', {
    method: 'POST',
    body: JSON.stringify({ project, index }),
  });
}

export async function reorderTimeline(
  project: ProjectBody,
  fromIndex: number,
  toIndex: number,
): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/reorder', {
    method: 'POST',
    body: JSON.stringify({ project, fromIndex, toIndex }),
  });
}

export async function deleteTimelineEntry(
  project: ProjectBody,
  index: number,
): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/delete-entry', {
    method: 'POST',
    body: JSON.stringify({ project, index }),
  });
}

export async function duplicateFrame(params: {
  project: ProjectBody;
  sourceIndex: number;
  options: FrameDuplicateOptions;
  knownFilenames: string[];
}): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/duplicate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function appendRecordedFrame(params: {
  project: ProjectBody;
  sourceIndex: number;
  divisions: import('../types/project').DivisionMarker[];
  knownFilenames: string[];
}): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/append-recorded-frame', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function reconcileFilenames(
  project: ProjectBody,
  filenames: string[],
): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/reconcile', {
    method: 'POST',
    body: JSON.stringify({ project, filenames }),
  });
}

export async function initFromFilenames(
  filenames: string[],
): Promise<ProjectMutationResponse> {
  return apiFetch('/timeline/init-from-filenames', {
    method: 'POST',
    body: JSON.stringify({ filenames }),
  });
}

export async function compileVideo(
  frames: Blob[],
  secondsPerFrame: number,
  frameDurations?: number[],
): Promise<Blob> {
  const form = new FormData();
  form.append('seconds_per_frame', String(secondsPerFrame));
  if (frameDurations && frameDurations.length === frames.length) {
    form.append('frame_durations', JSON.stringify(frameDurations));
  }
  frames.forEach((blob, i) => {
    form.append('frames', blob, `frame_${String(i).padStart(4, '0')}.png`);
  });
  const res = await fetch('/api/video/compile', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      const raw = body.detail;
      if (typeof raw === 'string') detail = raw;
      else if (Array.isArray(raw)) detail = raw.map((x: { msg?: string }) => x.msg).join('; ');
      else if (raw) detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.blob();
}
