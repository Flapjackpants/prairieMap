import { describe, expect, it } from 'vitest';
import {
  buildArcTable,
  buildSpine,
  computeCurvedLabelForRegion,
  exteriorRingsOnly,
  layoutGlyphs,
  pointAtArcLength,
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
    expect(label.letterSpacing).toBeCloseTo(label.fontSize * 0.52, 5);
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
    const glyphs = layoutGlyphs('ABC', spine, 20, 20 * 0.52);
    expect(glyphs).toHaveLength(3);
    const midSpine = pointAtArcLength(spine, table.total / 2, table);
    const midGlyph = glyphs[1]!;
    expect(Math.hypot(midGlyph.x - midSpine.x, midGlyph.y - midSpine.y)).toBeLessThan(30);
  });

  it('uses equal spacing between glyph centers along arc', () => {
    const spine = buildSpine(ring);
    const letterSpacing = 10;
    const fontSize = 20;
    const glyphs = layoutGlyphs('AB', spine, fontSize, letterSpacing);
    const table = buildArcTable(spine);
    const arcAt = (g: (typeof glyphs)[0]) => {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i <= 48; i++) {
        const len = table.lengths[i]!;
        const pt = pointAtArcLength(spine, len, table);
        const d = Math.hypot(pt.x - g.x, pt.y - g.y);
        if (d < bestDist) {
          bestDist = d;
          best = len;
        }
      }
      return best;
    };
    const gap = arcAt(glyphs[1]!) - arcAt(glyphs[0]!);
    const charWidth = fontSize * 0.58;
    expect(gap).toBeCloseTo(charWidth + letterSpacing, 0);
  });

  it('applies tangent rotation along the curve', () => {
    const spine = buildSpine(ring);
    const glyphs = layoutGlyphs('LONGNAME', spine, 18, 9);
    const rotations = new Set(glyphs.map((g) => Math.round(g.rotation)));
    expect(rotations.size).toBeGreaterThan(1);
  });
});
