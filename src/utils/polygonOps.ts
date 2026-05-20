import polygonClipping from 'polygon-clipping';
import { v4 as uuidv4 } from 'uuid';
import type { CountryTerritory, PolygonRing } from '../types/project';
import { polygonArea } from './territoryGeometry';
import { recomputeCountryLabels } from './territoryGeometry';

type Ring = [number, number][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const MIN_REGION_AREA = 80;

function toClippingRing(ring: PolygonRing): Ring {
  return ring.map(([x, y]) => [x, y]);
}

function ringsFromMultiPolygon(mp: MultiPolygon): PolygonRing[] {
  const out: PolygonRing[] = [];
  for (const poly of mp) {
    if (!poly?.length || poly[0].length < 3) continue;
    const ring = poly[0].map(([x, y]) => [x, y] as [number, number]);
    if (polygonArea(ring) >= MIN_REGION_AREA) out.push(ring);
  }
  return out;
}

/** Union all rings into non-overlapping polygons (merges same-nation overlaps). */
export function unionAllRegions(regions: PolygonRing[]): PolygonRing[] {
  const valid = regions.filter((r) => r.length >= 3);
  if (valid.length === 0) return [];
  if (valid.length === 1) return valid;

  try {
    let result: MultiPolygon = [[toClippingRing(valid[0])]];
    for (let i = 1; i < valid.length; i++) {
      result = polygonClipping.union(result, [
        [toClippingRing(valid[i])],
      ]) as MultiPolygon;
    }
    const merged = ringsFromMultiPolygon(result);
    return merged.length > 0 ? merged : valid;
  } catch {
    return valid;
  }
}

export function subtractPolygon(target: PolygonRing, cutter: PolygonRing): PolygonRing[] {
  if (target.length < 3 || cutter.length < 3) return target.length >= 3 ? [target] : [];
  try {
    const result = polygonClipping.difference(
      [toClippingRing(target)] as Polygon,
      [toClippingRing(cutter)] as Polygon,
    ) as MultiPolygon;
    const rings = ringsFromMultiPolygon(result);
    return rings.length > 0 ? rings : [];
  } catch {
    return [target];
  }
}

export function applyTerritoryTransfer(
  countries: CountryTerritory[],
  newRing: PolygonRing,
  activeFactionId: string,
  factionName: string,
  color: string,
): CountryTerritory[] {
  const updated: CountryTerritory[] = [];

  for (const country of countries) {
    if (country.factionId === activeFactionId) {
      updated.push(country);
      continue;
    }

    const newRegions: PolygonRing[] = [];
    for (const region of country.regions) {
      newRegions.push(...subtractPolygon(region, newRing));
    }

    if (newRegions.length === 0) continue;

    updated.push(recomputeCountryLabels({ ...country, regions: newRegions }));
  }

  const activeIdx = updated.findIndex((c) => c.factionId === activeFactionId);
  if (activeIdx < 0) {
    const merged = unionAllRegions([newRing]);
    updated.push(
      recomputeCountryLabels({
        id: uuidv4(),
        factionId: activeFactionId,
        name: factionName.toUpperCase(),
        color,
        labelSettings: { fontSize: 14, rotation: 0, letterSpacing: 0 },
        regionLabels: [],
        regions: merged,
      }),
    );
  } else {
    const merged = unionAllRegions([...updated[activeIdx].regions, newRing]);
    updated[activeIdx] = recomputeCountryLabels({
      ...updated[activeIdx],
      name: factionName.toUpperCase(),
      color,
      regions: merged,
    });
  }

  return updated;
}
