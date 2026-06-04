import type { CityMarker, DivisionMarker } from '../types/project';

const MOTION_EPSILON = 0.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Trim + lowercase for cross-frame division matching. */
export function normalizeDivisionName(name: string): string {
  return name.trim().toLowerCase();
}

export interface DivisionMotionPair {
  from: DivisionMarker;
  to: DivisionMarker;
}

/** Pair by non-empty matching name first, then by id. */
export function pairDivisionsForMotion(
  from: DivisionMarker[],
  to: DivisionMarker[],
): DivisionMotionPair[] {
  const pairs: DivisionMotionPair[] = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  for (const b of to) {
    const key = normalizeDivisionName(b.name);
    if (!key) continue;
    const a = from.find(
      (f) => !usedFrom.has(f.id) && normalizeDivisionName(f.name) === key,
    );
    if (a) {
      pairs.push({ from: a, to: b });
      usedFrom.add(a.id);
      usedTo.add(b.id);
    }
  }

  for (const b of to) {
    if (usedTo.has(b.id)) continue;
    const a = from.find((f) => !usedFrom.has(f.id) && f.id === b.id);
    if (a) {
      pairs.push({ from: a, to: b });
      usedFrom.add(a.id);
      usedTo.add(b.id);
    }
  }

  for (const a of from) {
    if (usedFrom.has(a.id)) continue;
    const b = to.find((f) => !usedTo.has(f.id) && f.id === a.id);
    if (b) {
      pairs.push({ from: a, to: b });
      usedFrom.add(a.id);
      usedTo.add(b.id);
    }
  }

  return pairs;
}

/** Smooth ease for division motion (0..1 in, 0..1 out). */
export function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** True when any paired division moves between frames. */
export function hasMovingDivisions(
  from: DivisionMarker[],
  to: DivisionMarker[],
): boolean {
  for (const { from: a, to: b } of pairDivisionsForMotion(from, to)) {
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

/** Interpolate paired divisions; unpaired use appear/disappear at endpoints. */
export function interpolateDivisions(
  from: DivisionMarker[],
  to: DivisionMarker[],
  t: number,
): DivisionMarker[] {
  const pairs = pairDivisionsForMotion(from, to);
  const pairedFromIds = new Set(pairs.map((p) => p.from.id));
  const pairedToIds = new Set(pairs.map((p) => p.to.id));
  const result: DivisionMarker[] = [];

  for (const { from: a, to: b } of pairs) {
    result.push({
      ...b,
      id: b.id,
      name: b.name || a.name,
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      size: lerp(a.size, b.size, t),
      crop: { ...b.crop },
      sourceFilename: b.sourceFilename,
    });
  }

  for (const a of from) {
    if (pairedFromIds.has(a.id)) continue;
    if (t <= 0) result.push({ ...a, crop: { ...a.crop } });
    else if (t < 1) result.push({ ...a, crop: { ...a.crop } });
  }

  for (const b of to) {
    if (pairedToIds.has(b.id)) continue;
    if (t >= 1) result.push({ ...b, crop: { ...b.crop } });
    else if (t > 0) result.push({ ...b, crop: { ...b.crop } });
  }

  return result;
}

/** Cities use target keyframe for segment (no interpolation in v1). */
export function citiesForSegment(from: CityMarker[], to: CityMarker[], t: number): CityMarker[] {
  return t >= 1 ? to : from;
}
