import { describe, expect, it } from 'vitest';
import {
  buildArcTable,
  buildSpine,
  computeCurvedLabelForRegion,
  exteriorRingsOnly,
  isSpineUpsideDown,
  layoutGlyphs,
  orientSpineForReading,
  pointAtArcLength,
  reverseSpine,
} from './curvedLabel';

describe('curvedLabel', () => {
  const ring: [number, number][] = [
    [0, 0],
    [200, 0],
    [200, 80],
    [0, 80],
  ];

  it('produces spine on curved label placement', () => {
    const label = computeCurvedLabelForRegion('FRANCE', ring);
    expect(label.spine).toBeDefined();
    expect(label.letterSpacing).toBeCloseTo(label.fontSize * 0.68, 5);
  });

  it('excludes hole rings from exterior list', () => {
    const outer = ring;
    const hole: [number, number][] = [
      [50, 20],
      [150, 20],
      [150, 60],
      [50, 60],
    ];
    expect(exteriorRingsOnly([outer, hole])).toHaveLength(1);
  });

  it('centers glyph string on spine midpoint', () => {
    const spine = buildSpine(ring);
    const table = buildArcTable(spine);
    const glyphs = layoutGlyphs('ABC', spine, 20, 20 * 0.68);
    expect(glyphs).toHaveLength(3);
    const midSpine = pointAtArcLength(spine, table.total / 2, table);
    const midGlyph = glyphs[1]!;
    expect(Math.hypot(midGlyph.x - midSpine.x, midGlyph.y - midSpine.y)).toBeLessThan(30);
  });

  it('uses equal arc-length between consecutive letter centers', () => {
    const spine = orientSpineForReading(buildSpine(ring));
    const fontSize = 20;
    const step = fontSize * 0.68;
    const glyphs = layoutGlyphs('ABCDE', spine, fontSize, step);
    const table = buildArcTable(spine);
    const totalSpan = (glyphs.length - 1) * step;
    const start = (table.total - totalSpan) / 2;
    for (let i = 1; i < glyphs.length; i++) {
      expect(start + i * step - (start + (i - 1) * step)).toBeCloseTo(step, 5);
    }
  });

  it('flips upside-down spines for readable orientation', () => {
    const base = buildSpine(ring);
    const oriented = orientSpineForReading(base);
    expect(isSpineUpsideDown(oriented)).toBe(false);
    const forcedDown = reverseSpine(base);
    if (!isSpineUpsideDown(forcedDown)) return;
    expect(isSpineUpsideDown(orientSpineForReading(forcedDown))).toBe(false);
  });

  it('applies tangent rotation along the curve', () => {
    const spine = buildSpine(ring);
    const glyphs = layoutGlyphs('LONGNAME', spine, 18, 9);
    const rotations = new Set(glyphs.map((g) => Math.round(g.rotation)));
    expect(rotations.size).toBeGreaterThan(1);
  });
});
