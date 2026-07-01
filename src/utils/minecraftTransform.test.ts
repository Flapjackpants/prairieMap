import { describe, expect, it } from 'vitest';
import { buildTransform, calibrationFitError, gameToMap } from './minecraftTransform';

describe('minecraftTransform', () => {
  it('maps calibration points exactly (linear X and Z)', () => {
    const a = { gameX: 0, gameZ: 0, mapX: 100, mapY: 200 };
    const b = { gameX: 10, gameZ: 20, mapX: 200, mapY: 300 };
    const t = buildTransform(a, b);
    expect(t.scaleX).toBeCloseTo(10);
    expect(t.scaleZ).toBeCloseTo(5);
    expect(gameToMap(t, 0, 0)).toEqual({ x: 100, y: 200 });
    expect(gameToMap(t, 10, 20)).toEqual({ x: 200, y: 300 });
    expect(calibrationFitError(t, a, b)).toBeLessThan(1e-9);
  });

  it('maps partial-world region with large world coordinates', () => {
    const a = { gameX: 5100, gameZ: 5200, mapX: 100, mapY: 200 };
    const b = { gameX: 5200, gameZ: 5300, mapX: 200, mapY: 300 };
    const t = buildTransform(a, b);
    expect(t.scaleX).toBeCloseTo(1);
    expect(t.scaleZ).toBeCloseTo(1);
    expect(gameToMap(t, 5150, 5250)).toEqual({ x: 150, y: 250 });
  });

  it('supports non-uniform px-per-block scales', () => {
    const a = { gameX: 0, gameZ: 0, mapX: 0, mapY: 0 };
    const b = { gameX: 100, gameZ: 100, mapX: 200, mapY: 50 };
    const t = buildTransform(a, b);
    expect(gameToMap(t, 50, 50)).toEqual({ x: 100, y: 25 });
  });

  it('rejects calibration that only moves on one game axis', () => {
    expect(() =>
      buildTransform(
        { gameX: 0, gameZ: 0, mapX: 0, mapY: 0 },
        { gameX: 10, gameZ: 0, mapX: 100, mapY: 0 },
      ),
    ).toThrow(/game Z/);
    expect(() =>
      buildTransform(
        { gameX: 0, gameZ: 0, mapX: 0, mapY: 0 },
        { gameX: 0, gameZ: 10, mapX: 0, mapY: 100 },
      ),
    ).toThrow(/game X/);
  });
});
