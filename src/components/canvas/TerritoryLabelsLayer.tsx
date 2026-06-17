import { Group } from 'react-konva';
import { memo } from 'react';
import type { CountryTerritory } from '../../types/project';
import { CurvedRegionLabels } from './CurvedRegionLabels';

interface TerritoryLabelsLayerProps {
  countries: CountryTerritory[];
  showLabels?: boolean;
}

/** Curved nation labels only (no fills or handles). */
export const TerritoryLabelsLayer = memo(function TerritoryLabelsLayer({
  countries,
  showLabels = true,
}: TerritoryLabelsLayerProps) {
  if (!showLabels) return null;
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
});
