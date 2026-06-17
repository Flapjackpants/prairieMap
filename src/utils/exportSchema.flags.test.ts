import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE } from '../types/project';
import { stateToExport, importToAssets } from './exportSchema';
import type { ProjectState } from '../types/project';
import { DEFAULT_DISPLAY_SETTINGS } from '../types/displaySettings';

function minimalState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    projectName: 'Test',
    assets: {},
    timeline: [],
    fileRegistry: {},
    palette: DEFAULT_PALETTE,
    carryOverLabels: true,
    currentTimelineIndex: 0,
    visitedTimelineIds: [],
    displaySettings: DEFAULT_DISPLAY_SETTINGS,
    tool: 'pan',
    activeColorId: DEFAULT_PALETTE[0].id,
    selectedCountryId: null,
    selectedMarkerId: null,
    selectedMarkerKind: null,
    ...overrides,
  };
}

describe('exportSchema flags', () => {
  it('round-trips flagFilename on palette', () => {
    const palette = DEFAULT_PALETTE.map((p, i) =>
      i === 0 ? { ...p, flagFilename: 'usa.png' } : p,
    );
    const exported = stateToExport(minimalState({ palette }));
    expect(exported.palette[0].flagFilename).toBe('usa.png');

    const imported = importToAssets(exported);
    expect(imported.palette[0].flagFilename).toBe('usa.png');
  });
});
