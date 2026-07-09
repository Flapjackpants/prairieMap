import { describe, expect, it } from 'vitest';
import {
  clampRenderLayout,
  DEFAULT_RENDER_LAYOUT,
  defaultFrameRenderOptions,
  videoExportRenderOptions,
} from '../types/renderOptions';
import { DEFAULT_DISPLAY_SETTINGS } from './displaySettings';

describe('renderOptions', () => {
  it('defaults frame render dossier on when frame has dossier content', () => {
    expect(defaultFrameRenderOptions(DEFAULT_DISPLAY_SETTINGS, false).showDossier).toBe(false);
    expect(defaultFrameRenderOptions(DEFAULT_DISPLAY_SETTINGS, true).showDossier).toBe(true);
  });

  it('includes layout and active division defaults', () => {
    const options = videoExportRenderOptions(DEFAULT_DISPLAY_SETTINGS);
    expect(options.showActiveDivisions).toBe(true);
    expect(options.layout).toEqual(DEFAULT_RENDER_LAYOUT);
  });

  it('clamps render layout values', () => {
    expect(
      clampRenderLayout({
        mapScale: 9,
        dossierWidthFraction: 0.01,
        dateFontScale: 0.1,
        eventLogFontScale: 3,
        activeDivisionsIconScale: -1,
      }),
    ).toEqual({
      mapScale: 1,
      dossierWidthFraction: 0.1,
      dateFontScale: 0.5,
      eventLogFontScale: 2,
      activeDivisionsIconScale: 0.5,
    });
  });
});
