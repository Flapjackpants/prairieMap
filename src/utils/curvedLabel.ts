import type { LabelSpine, PolygonRing, RegionLabelPlacement } from '../types/project';
import { combinedBounds, polygonArea, polygonCentroid } from './territoryGeometry';

export const LABEL_MIN_FONT = 9;
export const LABEL_MAX_FONT = 48;
export const LETTER_SPACING_FACTOR = 0.68;
export const CHAR_WIDTH_FACTOR = 0.58;
export const SPINE_LENGTH_FACTOR = 0.48;
export const SPINE_MINOR_INSET = 0.38;
export const ARC_SAMPLES = 48;

export interface GlyphPlacement {
  char: string;
  x: number;
  y: number;
  rotation: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function defaultCharWidth(fontSize: number): number {
  return fontSize * CHAR_WIDTH_FACTOR;
}

export function pointInRing(point: { x: number; y: number }, ring: PolygonRing): boolean {
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Skip interior hole rings (even-odd territories). */
export function exteriorRingsOnly(regions: PolygonRing[]): PolygonRing[] {
  const valid = regions.filter((ring) => ring.length >= 3 && polygonArea(ring) >= 1);
  return valid.filter((ring) => {
    const center = polygonCentroid(ring);
    const area = polygonArea(ring);
    for (const other of valid) {
      if (other === ring) continue;
      if (polygonArea(other) > area && pointInRing(center, other)) return false;
    }
    return true;
  });
}

export function computePrincipalAxis(ring: PolygonRing): {
  dx: number;
  dy: number;
  span: number;
  minorSpan: number;
} {
  const center = polygonCentroid(ring);
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const [x, y] of ring) {
    const px = x - center.x;
    const py = y - center.y;
    xx += px * px;
    yy += py * py;
    xy += px * py;
  }
  const n = Math.max(ring.length, 1);
  xx /= n;
  yy /= n;
  xy /= n;

  const trace = xx + yy;
  const det = xx * yy - xy * xy;
  const disc = Math.max(0, (trace / 2) ** 2 - det);
  const lambda1 = trace / 2 + Math.sqrt(disc);

  let dx = xy;
  let dy = lambda1 - xx;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 1;
    dy = 0;
    len = 1;
  } else {
    dx /= len;
    dy /= len;
  }

  let minMaj = Infinity;
  let maxMaj = -Infinity;
  let minMin = Infinity;
  let maxMin = -Infinity;
  const perpX = -dy;
  const perpY = dx;
  for (const [x, y] of ring) {
    const px = x - center.x;
    const py = y - center.y;
    const maj = px * dx + py * dy;
    const min = px * perpX + py * perpY;
    minMaj = Math.min(minMaj, maj);
    maxMaj = Math.max(maxMaj, maj);
    minMin = Math.min(minMin, min);
    maxMin = Math.max(maxMin, min);
  }

  return {
    dx,
    dy,
    span: Math.max(maxMaj - minMaj, 1),
    minorSpan: Math.max(maxMin - minMin, 1),
  };
}

export function reverseSpine(spine: LabelSpine): LabelSpine {
  return {
    x1: spine.x2,
    y1: spine.y2,
    cx: spine.cx,
    cy: spine.cy,
    x2: spine.x1,
    y2: spine.y1,
  };
}

/** True when tangent at midpoint reads upward on screen (Y-down canvas). */
export function isSpineUpsideDown(spine: LabelSpine): boolean {
  const deg = tangentDegreesAt(spine, 0.5);
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d > 90 || d < -90;
}

export function orientSpineForReading(spine: LabelSpine): LabelSpine {
  return isSpineUpsideDown(spine) ? reverseSpine(spine) : spine;
}

export function buildSpine(
  ring: PolygonRing,
  lengthFactor: number = SPINE_LENGTH_FACTOR,
): LabelSpine {
  const center = polygonCentroid(ring);
  const { dx, dy, span, minorSpan } = computePrincipalAxis(ring);
  const halfLen = Math.min((span * lengthFactor) / 2, (minorSpan * SPINE_MINOR_INSET) / 2);
  const perpX = -dy;
  const perpY = dx;
  const bulge = minorSpan * 0.05;

  return {
    x1: center.x - dx * halfLen,
    y1: center.y - dy * halfLen,
    cx: center.x + perpX * bulge,
    cy: center.y + perpY * bulge,
    x2: center.x + dx * halfLen,
    y2: center.y + dy * halfLen,
  };
}

function spineKey(spine: LabelSpine): string {
  return `${spine.x1},${spine.y1},${spine.x2},${spine.y2}`;
}

export function spineCandidates(
  ring: PolygonRing,
  lengthFactor: number = SPINE_LENGTH_FACTOR,
): LabelSpine[] {
  const base = buildSpine(ring, lengthFactor);
  const a = orientSpineForReading(base);
  const b = orientSpineForReading(reverseSpine(base));
  return spineKey(a) === spineKey(b) ? [a] : [a, b];
}

export function scoreLabelLayout(
  glyphs: GlyphPlacement[],
  ownRing: PolygonRing,
  foreignRings: PolygonRing[],
): number {
  let score = 0;
  for (const g of glyphs) {
    const pt = { x: g.x, y: g.y };
    if (pointInRing(pt, ownRing)) score += 10;
    else score -= 18;
    for (const foreign of foreignRings) {
      if (pointInRing(pt, foreign)) score -= 30;
    }
  }
  return score;
}

export function layoutGlyphsForRegion(
  name: string,
  ring: PolygonRing,
  fontSize: number,
  foreignRings: PolygonRing[] = [],
): { glyphs: GlyphPlacement[]; spine: LabelSpine; fontSize: number; letterSpacing: number } {
  let bestGlyphs: GlyphPlacement[] = [];
  let bestSpine = orientSpineForReading(buildSpine(ring));
  let bestScore = -Infinity;
  let bestFontSize = fontSize;
  let bestLetterSpacing = fontSize * LETTER_SPACING_FACTOR;

  for (const lengthFactor of [SPINE_LENGTH_FACTOR, 0.4, 0.32]) {
    for (let fs = fontSize; fs >= fontSize * 0.62; fs -= fontSize * 0.1) {
      const letterSpacing = fs * LETTER_SPACING_FACTOR;
      for (const spine of spineCandidates(ring, lengthFactor)) {
        const glyphs = layoutGlyphs(name, spine, fs, letterSpacing);
        if (glyphs.length === 0) continue;
        const score = scoreLabelLayout(glyphs, ring, foreignRings);
        if (score > bestScore) {
          bestScore = score;
          bestGlyphs = glyphs;
          bestSpine = spine;
          bestFontSize = fs;
          bestLetterSpacing = letterSpacing;
        }
      }
    }
  }

  return {
    glyphs: bestGlyphs,
    spine: bestSpine,
    fontSize: bestFontSize,
    letterSpacing: bestLetterSpacing,
  };
}

function quadPoint(spine: LabelSpine, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * spine.x1 + 2 * u * t * spine.cx + t * t * spine.x2,
    y: u * u * spine.y1 + 2 * u * t * spine.cy + t * t * spine.y2,
  };
}

function quadTangent(spine: LabelSpine, t: number): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 2 * u * (spine.cx - spine.x1) + 2 * t * (spine.x2 - spine.cx),
    y: 2 * u * (spine.cy - spine.y1) + 2 * t * (spine.y2 - spine.cy),
  };
}

export function buildArcTable(spine: LabelSpine): {
  lengths: number[];
  total: number;
} {
  const lengths: number[] = [0];
  let prev = quadPoint(spine, 0);
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const p = quadPoint(spine, t);
    lengths.push(lengths[i - 1]! + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  return { lengths, total: lengths[lengths.length - 1]! };
}

export function pointAtArcLength(
  spine: LabelSpine,
  arcLen: number,
  table = buildArcTable(spine),
): { x: number; y: number; t: number } {
  const target = clamp(arcLen, 0, table.total);
  let lo = 0;
  let hi = ARC_SAMPLES;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (table.lengths[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const len0 = table.lengths[i - 1]!;
  const len1 = table.lengths[i]!;
  const seg = len1 - len0 || 1;
  const frac = (target - len0) / seg;
  const t = (i - 1 + frac) / ARC_SAMPLES;
  return { ...quadPoint(spine, t), t };
}

export function tangentDegreesAt(spine: LabelSpine, t: number): number {
  const tan = quadTangent(spine, clamp(t, 0, 1));
  return (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
}

/** Fixed arc-length between consecutive letter centers (HoI4-style). */
export function equalLetterStep(fontSize: number): number {
  return fontSize * LETTER_SPACING_FACTOR;
}

export function layoutGlyphs(
  name: string,
  spine: LabelSpine,
  fontSize: number,
  letterSpacing: number = equalLetterStep(fontSize),
): GlyphPlacement[] {
  const chars = [...name.toUpperCase()];
  if (chars.length === 0) return [];

  const oriented = orientSpineForReading(spine);
  const table = buildArcTable(oriented);

  if (chars.length === 1) {
    const { t } = pointAtArcLength(oriented, table.total / 2, table);
    const { x, y } = quadPoint(oriented, t);
    return [
      {
        char: chars[0]!,
        x,
        y,
        rotation: tangentDegreesAt(oriented, t),
      },
    ];
  }

  let step = letterSpacing;
  let totalSpan = (chars.length - 1) * step;
  const maxSpan = table.total * 0.92;
  if (totalSpan > maxSpan) {
    step = maxSpan / (chars.length - 1);
    totalSpan = maxSpan;
  }
  const start = (table.total - totalSpan) / 2;

  const glyphs: GlyphPlacement[] = [];
  for (let i = 0; i < chars.length; i++) {
    const centerArc = start + i * step;
    const { t } = pointAtArcLength(oriented, centerArc, table);
    const { x, y } = quadPoint(oriented, t);
    glyphs.push({
      char: chars[i]!,
      x,
      y,
      rotation: tangentDegreesAt(oriented, t),
    });
  }
  return glyphs;
}

export function computeCurvedLabelForRegion(
  name: string,
  ring: PolygonRing,
  foreignRings: PolygonRing[] = [],
): RegionLabelPlacement {
  const bounds = combinedBounds([ring]);
  const area = polygonArea(ring);
  const span = Math.max(bounds.width, bounds.height, 1);
  const baseFontSize = clamp(Math.sqrt(area) * 0.08 + span * 0.018, LABEL_MIN_FONT, LABEL_MAX_FONT);
  const { spine, fontSize, letterSpacing } = layoutGlyphsForRegion(
    name,
    ring,
    baseFontSize,
    foreignRings,
  );
  const mid = pointAtArcLength(spine, buildArcTable(spine).total / 2);

  return {
    x: mid.x,
    y: mid.y,
    fontSize,
    letterSpacing,
    spine,
    rotation: tangentDegreesAt(spine, 0.5),
  };
}
