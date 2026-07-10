import type { DivisionMarker, ProjectState } from '../types/project';
import { resolveTimelineEntry } from './projectHelpers';

export function divisionsAtFrame(state: ProjectState, frameIndex: number): DivisionMarker[] {
  const resolved = resolveTimelineEntry(state, frameIndex);
  return resolved?.frameData.annotations.divisions ?? [];
}

/** Divisions alive on the given timeline frame (present in that frame's marker list). */
export function computeActiveDivisions(
  state: ProjectState,
  frameIndex: number,
): DivisionMarker[] {
  return divisionsAtFrame(state, frameIndex);
}

export function divisionIconKey(division: DivisionMarker): string {
  return division.sourceFilename;
}

/** One row per division; same icon file entries are listed consecutively. */
export function sortDivisionsByIconFile(divisions: DivisionMarker[]): DivisionMarker[] {
  return divisions
    .map((division, index) => ({ division, index }))
    .sort((a, b) => {
      const iconCompare = divisionIconKey(a.division).localeCompare(divisionIconKey(b.division));
      return iconCompare !== 0 ? iconCompare : a.index - b.index;
    })
    .map(({ division }) => division);
}
