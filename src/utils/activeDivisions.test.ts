import { describe, expect, it } from 'vitest';
import type { DivisionMarker, ProjectState } from '../types/project';
import { DEFAULT_PALETTE, createEmptyAssetState } from '../types/project';
import {
  computeActiveDivisions,
  divisionIconKey,
  divisionsAtFrame,
  groupDivisionsByIcon,
} from './activeDivisions';

function division(id: string, name: string, source = 'icon.png'): DivisionMarker {
  return {
    id,
    name,
    x: 10,
    y: 20,
    size: 32,
    sourceFilename: source,
    crop: { x: 0, y: 0, width: 16, height: 16 },
  };
}

function stateWithTimeline(
  divisionsByFrame: DivisionMarker[][],
): ProjectState {
  const assets: Record<string, ReturnType<typeof createEmptyAssetState>[]> = {
    'map1.png': [],
  };

  const timeline = divisionsByFrame.map((divisions, index) => {
    assets['map1.png'][index] = {
      ...createEmptyAssetState(),
      annotations: {
        ...createEmptyAssetState().annotations,
        divisions,
      },
    };
    return {
      id: `frame-${index}`,
      filename: 'map1.png',
      copyIndex: index,
    };
  });

  return {
    projectName: 'Test',
    assets,
    timeline,
    palette: DEFAULT_PALETTE,
    fileRegistry: {},
    currentTimelineIndex: 0,
    visitedTimelineIds: [],
    displaySettings: {
      cityTextSize: 11,
      territoryBorderWidth: 1.5,
      cityMarkerStrokeWidth: 1.5,
      territoryDisplayMode: 'color',
      syncEventLogsByDate: false,
    },
    tool: 'pan',
    activeColorId: DEFAULT_PALETTE[0].id,
    carryOverLabels: true,
    selectedCountryId: null,
    selectedMarkerId: null,
    selectedMarkerKind: null,
  };
}

describe('activeDivisions', () => {
  it('returns divisions present on the requested frame', () => {
    const state = stateWithTimeline([
      [division('a', 'Alpha')],
      [division('a', 'Alpha'), division('b', 'Bravo')],
      [division('b', 'Bravo')],
    ]);

    expect(divisionsAtFrame(state, 0).map((d) => d.id)).toEqual(['a']);
    expect(computeActiveDivisions(state, 1).map((d) => d.id)).toEqual(['a', 'b']);
    expect(computeActiveDivisions(state, 2).map((d) => d.id)).toEqual(['b']);
  });

  it('drops killed divisions from the active roster', () => {
    const state = stateWithTimeline([
      [division('a', 'Alpha'), division('b', 'Bravo')],
      [division('b', 'Bravo')],
    ]);

    expect(computeActiveDivisions(state, 0).map((d) => d.name)).toEqual(['Alpha', 'Bravo']);
    expect(computeActiveDivisions(state, 1).map((d) => d.name)).toEqual(['Bravo']);
  });

  it('groups divisions by icon file and collects names', () => {
    const sameIcon = division('a', 'First', 'shared.png');
    const sameIconOther = {
      ...division('b', 'Second', 'shared.png'),
      crop: { x: 4, y: 8, width: 20, height: 20 },
    };
    const otherIcon = division('c', 'Third', 'other.png');

    const groups = groupDivisionsByIcon([sameIcon, sameIconOther, otherIcon]);

    expect(groups).toHaveLength(2);
    expect(groups[0].names).toEqual(['First', 'Second']);
    expect(groups[1].names).toEqual(['Third']);
    expect(divisionIconKey(sameIcon)).toBe(divisionIconKey(sameIconOther));
    expect(divisionIconKey(sameIcon)).not.toBe(divisionIconKey(otherIcon));
  });
});
