import { describe, expect, it } from 'vitest';
import {
  hitStrokeWidthForScreenPx,
  mapRadiusForScreenPx,
} from './mapZoom';

describe('mapZoom', () => {
  it('shrinks map radius when zoomed in', () => {
    const at1 = mapRadiusForScreenPx(6, 1);
    const at2 = mapRadiusForScreenPx(6, 2);
    expect(at2).toBeLessThan(at1);
    expect(at2).toBe(3);
  });

  it('expands hit stroke when visible anchor is small', () => {
    const radius = mapRadiusForScreenPx(6, 2);
    const hit = hitStrokeWidthForScreenPx(14, radius, 2);
    expect(hit).toBeGreaterThan(0);
  });
});
