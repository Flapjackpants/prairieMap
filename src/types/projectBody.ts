import type {
  AssetFrameState,
  PaletteColor,
  ProjectDisplaySettings,
  ProjectState,
  TimelineEntry,
} from './project';
import { clampDisplaySettings, DEFAULT_DISPLAY_SETTINGS } from './displaySettings';

/** Server-persisted slice (no fileRegistry / UI-only fields). */
export interface ProjectBody {
  projectName: string;
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
  palette: PaletteColor[];
  carryOverLabels: boolean;
  currentTimelineIndex: number;
  visitedTimelineIds: string[];
  displaySettings: ProjectDisplaySettings;
}

export function toProjectBody(state: ProjectState): ProjectBody {
  return {
    projectName: state.projectName,
    assets: state.assets,
    timeline: state.timeline,
    palette: state.palette,
    carryOverLabels: state.carryOverLabels,
    currentTimelineIndex: state.currentTimelineIndex,
    visitedTimelineIds: state.visitedTimelineIds,
    displaySettings: state.displaySettings,
  };
}

export function mergeServerProject(
  prev: ProjectState,
  body: ProjectBody,
): ProjectState {
  return {
    ...prev,
    projectName: body.projectName,
    assets: body.assets,
    timeline: body.timeline,
    palette: body.palette.map((p) => ({ ...p, flagFilename: p.flagFilename ?? null })),
    carryOverLabels: body.carryOverLabels,
    currentTimelineIndex: body.currentTimelineIndex,
    visitedTimelineIds: body.visitedTimelineIds ?? [],
    displaySettings: clampDisplaySettings(body.displaySettings ?? DEFAULT_DISPLAY_SETTINGS),
  };
}
