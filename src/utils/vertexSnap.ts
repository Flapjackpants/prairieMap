import type { CountryTerritory, PolygonRing } from '../types/project';
import { SNAP_THRESHOLD_PX } from '../types/project';

export interface SnapVertex {
  x: number;
  y: number;
  source: 'map' | 'draft';
  index?: number;
}

export interface TerritoryVertexRef {
  x: number;
  y: number;
  countryId: string;
  factionId: string;
  ringIndex: number;
  vertexIndex: number;
}

export function collectTerritoryVertices(countries: CountryTerritory[]): TerritoryVertexRef[] {
  const verts: TerritoryVertexRef[] = [];
  for (const country of countries) {
    country.regions.forEach((ring, ringIndex) => {
      ring.forEach(([x, y], vertexIndex) => {
        verts.push({
          x,
          y,
          countryId: country.id,
          factionId: country.factionId,
          ringIndex,
          vertexIndex,
        });
      });
    });
  }
  return verts;
}

export function findNearestTerritoryVertex(
  point: { x: number; y: number },
  vertices: TerritoryVertexRef[],
  threshold: number,
): TerritoryVertexRef | null {
  let best: TerritoryVertexRef | null = null;
  let bestDist = threshold;
  for (const v of vertices) {
    const d = Math.hypot(point.x - v.x, point.y - v.y);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

export function collectSnapVertices(
  countries: CountryTerritory[],
  draftPoints: { x: number; y: number }[],
  excludeDraftIndex?: number,
): SnapVertex[] {
  const verts: SnapVertex[] = [];

  for (const country of countries) {
    for (const ring of country.regions) {
      for (const [x, y] of ring) {
        verts.push({ x, y, source: 'map' });
      }
    }
  }

  draftPoints.forEach((p, i) => {
    if (i === excludeDraftIndex) return;
    verts.push({ x: p.x, y: p.y, source: 'draft', index: i });
  });

  return verts;
}

export function findSnapTarget(
  point: { x: number; y: number },
  vertices: SnapVertex[],
  threshold = SNAP_THRESHOLD_PX,
): SnapVertex | null {
  let best: SnapVertex | null = null;
  let bestDist = threshold;

  for (const v of vertices) {
    const d = Math.hypot(point.x - v.x, point.y - v.y);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }

  return best;
}

export function ringPointToXY(ring: PolygonRing, index: number): { x: number; y: number } {
  const [x, y] = ring[index];
  return { x, y };
}
