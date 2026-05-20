import type { CountryTerritory, PolygonRing, RegionLabelPlacement } from '../types/project';

export function ringToFlatPoints(ring: PolygonRing): number[] {
  return ring.flatMap(([x, y]) => [x, y]);
}

export function polygonArea(ring: PolygonRing): number {
  let area = 0;
  const n = ring.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(ring: PolygonRing): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  let a = 0;
  const n = ring.length;
  if (n < 3) {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    return {
      x: xs.reduce((s, v) => s + v, 0) / (n || 1),
      y: ys.reduce((s, v) => s + v, 0) / (n || 1),
    };
  }
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    return {
      x: xs.reduce((s, v) => s + v, 0) / n,
      y: ys.reduce((s, v) => s + v, 0) / n,
    };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function combinedBounds(regions: PolygonRing[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const points = regions.flat();
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function totalTerritoryArea(regions: PolygonRing[]): number {
  return regions.reduce((sum, r) => sum + polygonArea(r), 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Flat label for a single disconnected region (exclave / island). */
export function computeFlatLabelForRegion(
  name: string,
  ring: PolygonRing,
): RegionLabelPlacement {
  const bounds = combinedBounds([ring]);
  const area = polygonArea(ring);
  const center = polygonCentroid(ring);
  const span = Math.max(bounds.width, bounds.height, 1);
  const fontSize = clamp(Math.sqrt(area) * 0.09 + span * 0.022, 9, 48);

  const charCount = Math.max(name.length, 1);
  let letterSpacing = 0;
  if (bounds.width > fontSize * charCount * 0.55) {
    letterSpacing = clamp(
      (bounds.width - fontSize * charCount * 0.5) / Math.max(charCount - 1, 1),
      0,
      fontSize * 0.2,
    );
  }

  return {
    x: center.x,
    y: center.y,
    fontSize,
    letterSpacing,
  };
}

/** One flat label per region ring (each non-contiguous landmass after union). */
export function computeRegionLabels(
  name: string,
  regions: PolygonRing[],
): RegionLabelPlacement[] {
  return regions
    .filter((ring) => ring.length >= 3 && polygonArea(ring) >= 1)
    .map((ring) => computeFlatLabelForRegion(name, ring));
}

export function recomputeCountryLabels(country: CountryTerritory): CountryTerritory {
  if (country.regions.length === 0) {
    return { ...country, regionLabels: [] };
  }

  const regionLabels = computeRegionLabels(country.name, country.regions);
  const primary = regionLabels[0];

  return {
    ...country,
    regionLabels,
    labelSettings: {
      fontSize: primary?.fontSize ?? 14,
      rotation: 0,
      letterSpacing: primary?.letterSpacing ?? 0,
    },
  };
}

export function adjustOutlineColor(hex: string, amount = -28): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = clamp(parseInt(h.slice(0, 2), 16) + amount, 0, 255);
  const g = clamp(parseInt(h.slice(2, 4), 16) + amount, 0, 255);
  const b = clamp(parseInt(h.slice(4, 6), 16) + amount, 0, 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function isNearPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  threshold = 12,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= threshold;
}

export function normalizeClosedRing(points: { x: number; y: number }[]): PolygonRing {
  if (points.length < 3) return points.map((p) => [p.x, p.y] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  const trimmed =
    points.length > 3 && isNearPoint(first, last, 8) ? points.slice(0, -1) : points;
  return trimmed.map((p) => [p.x, p.y] as [number, number]);
}
