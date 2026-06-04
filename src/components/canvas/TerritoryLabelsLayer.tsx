import { Group } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import { CurvedRegionLabels } from './CurvedRegionLabels';

interface TerritoryLabelsLayerProps {
  countries: CountryTerritory[];
}

/** Curved nation labels only (no fills or handles). */
export function TerritoryLabelsLayer({ countries }: TerritoryLabelsLayerProps) {
  return (
    <>
      {countries.map((country) => (
        <Group key={`labels-${country.id}`}>
          {country.regions.length > 0 && (
            <CurvedRegionLabels country={country} allCountries={countries} />
          )}
        </Group>
      ))}
    </>
  );
}
