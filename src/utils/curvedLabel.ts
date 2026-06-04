import type { LabelSpine, PolygonRing, RegionLabelPlacement } from '../types/project';
import { combinedBounds, polygonArea, polygonCentroid } from './territoryGeometry';

export const LABEL_MIN_FONT = 9;
export const LABEL_MAX_FONT = 48;
export const LETTER_SPACING_FACTOR = 0.52;
export const CHAR_WIDTH_FACTOR = 0.58;
export const SPINE_LENGTH_FACTOR = 0.65;
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

export function buildSpine(ring: PolygonRing): LabelSpine {
  const center = polygonCentroid(ring);
  const { dx, dy, span, minorSpan } = computePrincipalAxis(ring);
  const halfLen = (span * SPINE_LENGTH_FACTOR) / 2;
  const perpX = -dy;
  const perpY = dx;
  const bulge = minorSpan * 0.1;

  return {
    x1: center.x - dx * halfLen,
    y1: center.y - dy * halfLen,
    cx: center.x + perpX * bulge,
    cy: center.y + perpY * bulge,
    x2: center.x + dx * halfLen,
    y2: center.y + dy * halfLen,
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

export function layoutGlyphs(
  name: string,
  spine: LabelSpine,
  fontSize: number,
  letterSpacing: number,
  measureChar: (char: string) => number = () => defaultCharWidth(fontSize),
): GlyphPlacement[] {
  const chars = [...name.toUpperCase()];
  if (chars.length === 0) return [];

  const widths = chars.map((c) => measureChar(c));
  const totalWidth =
    widths.reduce((s, w) => s + w, 0) + Math.max(0, chars.length - 1) * letterSpacing;

  const table = buildArcTable(spine);
  const start = (table.total - totalWidth) / 2;

  const glyphs: GlyphPlacement[] = [];
  let cursor = start;
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i]!;
    const centerArc = cursor + w / 2;
    const { t } = pointAtArcLength(spine, centerArc, table);
    const { x, y } = quadPoint(spine, t);
    glyphs.push({
      char: chars[i]!,
      x,
      y,
      rotation: tangentDegreesAt(spine, t),
    });
    cursor += w + (i < chars.length - 1 ? letterSpacing : 0);
  }
  return glyphs;
}

export function computeCurvedLabelForRegion(
  _name: string,
  ring: PolygonRing,
): RegionLabelPlacement {
  const bounds = combinedBounds([ring]);
  const area = polygonArea(ring);
  const span = Math.max(bounds.width, bounds.height, 1);
  const fontSize = clamp(Math.sqrt(area) * 0.09 + span * 0.022, LABEL_MIN_FONT, LABEL_MAX_FONT);
  const letterSpacing = fontSize * LETTER_SPACING_FACTOR;
  const spine = buildSpine(ring);
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
