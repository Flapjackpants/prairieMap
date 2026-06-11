import type {
  AssetFrameState,
  PaletteColor,
  ProjectState,
  TimelineEntry,
} from './project';

/** Server-persisted slice (no fileRegistry / UI-only fields). */
export interface ProjectBody {
  projectName: string;
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
  palette: PaletteColor[];
  carryOverLabels: boolean;
  currentTimelineIndex: number;
  visitedTimelineIds: string[];
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
    palette: body.palette,
    carryOverLabels: body.carryOverLabels,
    currentTimelineIndex: body.currentTimelineIndex,
    visitedTimelineIds: body.visitedTimelineIds ?? [],
  };
}
