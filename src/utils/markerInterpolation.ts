import type { CityMarker, DivisionMarker } from '../types/project';

const MOTION_EPSILON = 0.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth ease for division motion (0..1 in, 0..1 out). */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** True when a division id exists in both frames with different position or size. */
export function hasMovingDivisions(
  from: DivisionMarker[],
  to: DivisionMarker[],
): boolean {
  const fromById = new Map(from.map((d) => [d.id, d]));
  for (const b of to) {
    const a = fromById.get(b.id);
    if (!a) continue;
    if (
      Math.abs(a.x - b.x) > MOTION_EPSILON ||
      Math.abs(a.y - b.y) > MOTION_EPSILON ||
      Math.abs(a.size - b.size) > MOTION_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

/** Subframes for a timeline gap; 1 when no division moves. */
export function segmentSubstepCount(
  secondsPerFrame: number,
  divisionMotionFps: number,
  from: DivisionMarker[],
  to: DivisionMarker[],
): number {
  if (!hasMovingDivisions(from, to)) return 1;
  return Math.max(2, Math.round(secondsPerFrame * divisionMotionFps));
}

/** Match by id; lerp position/size. Appear/disappear at endpoints (no fade). */
export function interpolateDivisions(
  from: DivisionMarker[],
  to: DivisionMarker[],
  t: number,
): DivisionMarker[] {
  const fromById = new Map(from.map((d) => [d.id, d]));
  const toById = new Map(to.map((d) => [d.id, d]));
  const ids = new Set([...fromById.keys(), ...toById.keys()]);
  const result: DivisionMarker[] = [];

  for (const id of ids) {
    const a = fromById.get(id);
    const b = toById.get(id);
    if (a && b) {
      result.push({
        ...b,
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        size: lerp(a.size, b.size, t),
        crop: { ...b.crop },
        sourceFilename: b.sourceFilename,
      });
    } else if (a && t <= 0) {
      result.push({ ...a, crop: { ...a.crop } });
    } else if (b && t >= 1) {
      result.push({ ...b, crop: { ...b.crop } });
    } else if (a && !b && t < 1) {
      result.push({ ...a, crop: { ...a.crop } });
    } else if (b && !a && t > 0) {
      result.push({ ...b, crop: { ...b.crop } });
    }
  }
  return result;
}

/** Cities use target keyframe for segment (no interpolation in v1). */
export function citiesForSegment(from: CityMarker[], to: CityMarker[], t: number): CityMarker[] {
  return t >= 1 ? to : from;
}
