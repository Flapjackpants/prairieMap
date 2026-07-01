import type { CalibrationPair } from '../types/minecraft';

/** Minimum block separation on each game axis between calibration A and B. */
export const MIN_AXIS_SEPARATION = 1;

/**
 * Two-point linear map: game X → pixel X, game Z → pixel Y.
 *   mapX = originMap.x + (gameX - originGame.x) * scaleX
 *   mapY = originMap.y + (gameZ - originGame.z) * scaleZ
 *
 * This is the correct model for axis-aligned regional maps (cropped dynmap tiles, etc.).
 * It does not assume world (0,0) is the image origin.
 */
export interface LinearMapTransform {
  scaleX: number;
  scaleZ: number;
  originGame: { x: number; z: number };
  originMap: { x: number; y: number };
}

/** @deprecated Use LinearMapTransform */
export type SimilarityTransform = LinearMapTransform;

export function buildTransform(a: CalibrationPair, b: CalibrationPair): LinearMapTransform {
  const gameDx = b.gameX - a.gameX;
  const gameDz = b.gameZ - a.gameZ;

  if (Math.abs(gameDx) < MIN_AXIS_SEPARATION) {
    throw new Error(
      'Calibration points must differ in game X (walk east/west between A and B, or pick spots farther apart).',
    );
  }
  if (Math.abs(gameDz) < MIN_AXIS_SEPARATION) {
    throw new Error(
      'Calibration points must differ in game Z (walk north/south between A and B, or pick spots farther apart).',
    );
  }

  return {
    scaleX: (b.mapX - a.mapX) / gameDx,
    scaleZ: (b.mapY - a.mapY) / gameDz,
    originGame: { x: a.gameX, z: a.gameZ },
    originMap: { x: a.mapX, y: a.mapY },
  };
}

export function gameToMap(
  transform: LinearMapTransform,
  gameX: number,
  gameZ: number,
): { x: number; y: number } {
  return {
    x: transform.originMap.x + (gameX - transform.originGame.x) * transform.scaleX,
    y: transform.originMap.y + (gameZ - transform.originGame.z) * transform.scaleZ,
  };
}

/** Returns max pixel error when reprojecting calibration points (for UI validation). */
export function calibrationFitError(
  transform: LinearMapTransform,
  a: CalibrationPair,
  b: CalibrationPair,
): number {
  const mappedA = gameToMap(transform, a.gameX, a.gameZ);
  const mappedB = gameToMap(transform, b.gameX, b.gameZ);
  return Math.max(
    Math.hypot(mappedA.x - a.mapX, mappedA.y - a.mapY),
    Math.hypot(mappedB.x - b.mapX, mappedB.y - b.mapY),
  );
}
