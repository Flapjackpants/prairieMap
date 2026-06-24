import type { CalibrationPair } from '../types/minecraft';

export interface SimilarityTransform {
  scale: number;
  rotation: number;
  originGame: { x: number; z: number };
  originMap: { x: number; y: number };
}

export function buildTransform(a: CalibrationPair, b: CalibrationPair): SimilarityTransform {
  const gameDx = b.gameX - a.gameX;
  const gameDz = b.gameZ - a.gameZ;
  const mapDx = b.mapX - a.mapX;
  const mapDy = b.mapY - a.mapY;
  const gameDist = Math.hypot(gameDx, gameDz);
  if (gameDist < 1) {
    throw new Error('Calibration points too close in game (need at least 1 block apart)');
  }
  const mapDist = Math.hypot(mapDx, mapDy);
  const scale = mapDist / gameDist;
  const gameAngle = Math.atan2(gameDz, gameDx);
  const mapAngle = Math.atan2(mapDy, mapDx);
  const rotation = mapAngle - gameAngle;
  return {
    scale,
    rotation,
    originGame: { x: a.gameX, z: a.gameZ },
    originMap: { x: a.mapX, y: a.mapY },
  };
}

export function gameToMap(
  transform: SimilarityTransform,
  gameX: number,
  gameZ: number,
): { x: number; y: number } {
  const dx = gameX - transform.originGame.x;
  const dz = gameZ - transform.originGame.z;
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const rx = dx * cos - dz * sin;
  const rz = dx * sin + dz * cos;
  return {
    x: transform.originMap.x + rx * transform.scale,
    y: transform.originMap.y + rz * transform.scale,
  };
}
