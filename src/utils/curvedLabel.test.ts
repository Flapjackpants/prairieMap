import { describe, expect, it } from 'vitest';
import {
  buildArcTable,
  buildSpine,
  computeCurvedLabelForRegion,
  exteriorRingsOnly,
  isSpineUpsideDown,
  layoutGlyphs,
  layoutGlyphsForRegion,
  minLetterStep,
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
    expect(label.letterSpacing).toBeGreaterThanOrEqual(minLetterStep(label.fontSize) - 0.01);
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
    const fs = 12;
    const glyphs = layoutGlyphs('ABC', spine, fs, Math.max(fs * 0.85, minLetterStep(fs)));
    expect(glyphs).toHaveLength(3);
    const midSpine = pointAtArcLength(spine, table.total / 2, table);
    const midGlyph = glyphs[1]!;
    expect(Math.hypot(midGlyph.x - midSpine.x, midGlyph.y - midSpine.y)).toBeLessThan(30);
  });

  it('uses equal arc-length between consecutive letter centers', () => {
    const spine = orientSpineForReading(buildSpine(ring));
    const fontSize = 20;
    const step = Math.max(fontSize * 0.85, minLetterStep(fontSize));
    const glyphs = layoutGlyphs('ABCDE', spine, fontSize, step);
    expect(glyphs).toHaveLength(5);
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
    const fs = 10;
    const glyphs = layoutGlyphs('ABCDE', spine, fs, Math.max(fs * 0.85, minLetterStep(fs)));
    expect(glyphs).toHaveLength(5);
    const rotations = new Set(glyphs.map((g) => Math.round(g.rotation)));
    expect(rotations.size).toBeGreaterThan(1);
  });

  it('always renders every letter on a short spine', () => {
    const smallRing: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ];
    const name = 'ABCDEFGHIJKLMNOP';
    const { glyphs, fontSize } = layoutGlyphsForRegion(name, smallRing, 28);
    expect(glyphs).toHaveLength(name.length);
    expect(fontSize).toBeLessThanOrEqual(28);
  });

  it('keeps equal spacing without stacking when label exceeds spine length', () => {
    const smallRing: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 20],
      [0, 20],
    ];
    const name = 'OUTERIS';
    const { glyphs, fontSize, letterSpacing } = layoutGlyphsForRegion(name, smallRing, 20);
    expect(glyphs).toHaveLength(name.length);
    const step = Math.max(letterSpacing, minLetterStep(fontSize));
    for (let i = 1; i < glyphs.length; i++) {
      const prev = glyphs[i - 1]!;
      const curr = glyphs[i]!;
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      expect(dist).toBeGreaterThanOrEqual(step * 0.85);
    }
  });

  it('never returns upside-down layout from layoutGlyphsForRegion', () => {
    const { spine, glyphs } = layoutGlyphsForRegion('TEST', ring, 16);
    expect(glyphs.length).toBe(4);
    expect(isSpineUpsideDown(spine)).toBe(false);
  });
});
