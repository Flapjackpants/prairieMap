import { describe, expect, it } from 'vitest';
import type { FrameRenderOptions } from '../types/renderOptions';
import { DEFAULT_RENDER_LAYOUT } from '../types/renderOptions';
import {
  computeRenderStageDimensions,
  computeStageDimensionsForRender,
} from './renderSnapshot';

describe('renderSnapshot', () => {
  const renderOptions: FrameRenderOptions = {
    showBackground: true,
    showLabels: true,
    territoryDisplayMode: 'color',
    showCities: true,
    showDivisions: true,
    showDossier: true,
    showActiveDivisions: true,
    layout: DEFAULT_RENDER_LAYOUT,
    visibleCountryIds: null,
  };

  it('scales stage dimensions down to the preview max', () => {
    const preview = computeRenderStageDimensions(3840, 2160, 480);
    expect(Math.max(preview.exportW, preview.exportH)).toBeLessThanOrEqual(480);
    expect(preview.exportW % 2).toBe(0);
    expect(preview.exportH % 2).toBe(0);
  });

  it('keeps small maps at native size when under the max', () => {
    const result = computeRenderStageDimensions(400, 300, 480);
    expect(result).toEqual({ exportW: 400, exportH: 300 });
  });

  it('adds dossier panel width when rendering with dossier enabled', () => {
    const base = computeRenderStageDimensions(800, 600, 1920);
    const withPanel = computeStageDimensionsForRender(800, 600, 1920, renderOptions, {
      dateTitle: 'June 1944',
      eventLog: '',
      activeDivisionCount: 0,
    });
    expect(withPanel.exportW).toBeGreaterThan(base.exportW);
    expect(withPanel.exportH).toBe(base.exportH);
  });
});
