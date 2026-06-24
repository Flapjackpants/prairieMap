import { describe, expect, it } from 'vitest';
import { buildTransform, gameToMap } from './minecraftTransform';

describe('minecraftTransform', () => {
  it('maps calibration points exactly', () => {
    const t = buildTransform(
      { gameX: 0, gameZ: 0, mapX: 100, mapY: 200 },
      { gameX: 10, gameZ: 0, mapX: 200, mapY: 200 },
    );
    expect(gameToMap(t, 0, 0)).toEqual({ x: 100, y: 200 });
    expect(gameToMap(t, 10, 0).x).toBeCloseTo(200);
    expect(gameToMap(t, 10, 0).y).toBeCloseTo(200);
  });

  it('handles rotation', () => {
    const t = buildTransform(
      { gameX: 0, gameZ: 0, mapX: 0, mapY: 0 },
      { gameX: 0, gameZ: 10, mapX: 10, mapY: 0 },
    );
    const p = gameToMap(t, 0, 10);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });

  it('rejects degenerate calibration', () => {
    expect(() =>
      buildTransform(
        { gameX: 5, gameZ: 5, mapX: 0, mapY: 0 },
        { gameX: 5.5, gameZ: 5, mapX: 100, mapY: 100 },
      ),
    ).toThrow(/too close/);
  });
});
