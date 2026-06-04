import { describe, expect, it } from 'vitest';
import {
  easeInOutCubic,
  hasMovingDivisions,
  interpolateDivisions,
  segmentSubstepCount,
} from './markerInterpolation';
import type { DivisionMarker } from '../types/project';

const base: DivisionMarker = {
  id: 'd1',
  x: 0,
  y: 0,
  size: 40,
  sourceFilename: 'a.png',
  crop: { x: 0, y: 0, width: 10, height: 10 },
};

describe('interpolateDivisions', () => {
  it('lerps position and size for shared id', () => {
    const from = [{ ...base, x: 0, y: 0, size: 40 }];
    const to = [{ ...base, x: 100, y: 50, size: 60 }];
    const mid = interpolateDivisions(from, to, 0.5)[0];
    expect(mid.x).toBe(50);
    expect(mid.y).toBe(25);
    expect(mid.size).toBe(50);
  });

  it('eased t moves slower than linear early in segment', () => {
    const from = [{ ...base, x: 0, y: 0, size: 40 }];
    const to = [{ ...base, x: 100, y: 0, size: 40 }];
    const easedEarly = interpolateDivisions(from, to, easeInOutCubic(0.25))[0];
    const linearEarly = interpolateDivisions(from, to, 0.25)[0];
    expect(easedEarly.x).toBeLessThan(linearEarly.x);
    expect(easedEarly.x).toBeGreaterThan(0);
  });

  it('keeps from-only at t=0', () => {
    const from = [{ ...base }];
    const to: DivisionMarker[] = [];
    expect(interpolateDivisions(from, to, 0)).toHaveLength(1);
    expect(interpolateDivisions(from, to, 0.5)).toHaveLength(1);
    expect(interpolateDivisions(from, to, 1)).toHaveLength(0);
  });
});

describe('easeInOutCubic', () => {
  it('hits endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe('segmentSubstepCount', () => {
  it('returns 1 when divisions do not move', () => {
    const markers = [{ ...base, x: 10, y: 10 }];
    expect(hasMovingDivisions(markers, markers)).toBe(false);
    expect(segmentSubstepCount(2, 24, markers, markers)).toBe(1);
  });

  it('scales with seconds and fps when moving', () => {
    const from = [{ ...base, x: 0, y: 0 }];
    const to = [{ ...base, x: 50, y: 0 }];
    expect(hasMovingDivisions(from, to)).toBe(true);
    expect(segmentSubstepCount(2, 24, from, to)).toBe(48);
  });
});
