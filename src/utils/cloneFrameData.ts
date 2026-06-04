import { v4 as uuidv4 } from 'uuid';
import type {
  AssetFrameState,
  CountryTerritory,
  FactionStat,
  FrameAnnotations,
  FrameInfo,
  PolygonRing,
} from '../types/project';
function cloneRing(ring: PolygonRing): PolygonRing {
  return ring.map(([x, y]) => [x, y] as [number, number]);
}

export function cloneCountry(country: CountryTerritory): CountryTerritory {
  const cloned: CountryTerritory = {
    id: uuidv4(),
    factionId: country.factionId,
    name: country.name,
    color: country.color,
    extensionColor: country.extensionColor,
    labelSettings: { ...country.labelSettings },
    regionLabels: country.regionLabels.map((l) => ({ ...l, spine: l.spine ? { ...l.spine } : undefined })),
    regions: country.regions.map(cloneRing),
    extensionRegions: (country.extensionRegions ?? []).map(cloneRing),
  };
  return cloned;
}

function cloneFactionStat(stat: FactionStat): FactionStat {
  return {
    id: uuidv4(),
    factionId: stat.factionId,
    metric: stat.metric,
    value: stat.value,
  };
}

export function cloneAnnotations(source: FrameAnnotations): FrameAnnotations {
  return {
    countries: source.countries.map(cloneCountry),
  };
}

export function cloneFrameInfo(source: FrameInfo): FrameInfo {
  return {
    dateTitle: source.dateTitle,
    description: source.description,
    factionStats: source.factionStats.map(cloneFactionStat),
  };
}

export function cloneAssetState(source: AssetFrameState): AssetFrameState {
  return {
    annotations: cloneAnnotations(source.annotations),
    info: cloneFrameInfo(source.info),
  };
}
