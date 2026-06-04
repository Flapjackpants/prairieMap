import type { CityMarker, DivisionMarker } from '../types/project';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
