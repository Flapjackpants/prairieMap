import { describe, expect, it } from 'vitest';
import { interpolateDivisions } from './markerInterpolation';
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

  it('keeps from-only at t=0', () => {
    const from = [{ ...base }];
    const to: DivisionMarker[] = [];
    expect(interpolateDivisions(from, to, 0)).toHaveLength(1);
    expect(interpolateDivisions(from, to, 0.5)).toHaveLength(1);
    expect(interpolateDivisions(from, to, 1)).toHaveLength(0);
  });
});
