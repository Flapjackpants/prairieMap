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

export interface DivisionIconGroup {
  key: string;
  representative: DivisionMarker;
  names: string[];
}

export function groupDivisionsByIcon(divisions: DivisionMarker[]): DivisionIconGroup[] {
  const groups = new Map<string, DivisionIconGroup>();

  for (const division of divisions) {
    const key = divisionIconKey(division);
    let group = groups.get(key);
    if (!group) {
      group = { key, representative: division, names: [] };
      groups.set(key, group);
    }
    const name = division.name.trim();
    if (name && !group.names.includes(name)) {
      group.names.push(name);
    }
  }

  return [...groups.values()];
}
