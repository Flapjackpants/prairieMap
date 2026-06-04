import { Group } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import { CountryTerritoryShape } from './CountryTerritoryShape';

interface TerritoryFillsLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  onSelectCountry?: (id: string) => void;
}

/** Territory fills/outlines only (no labels or handles). */
export function TerritoryFillsLayer({
  countries,
  selectedCountryId,
  onSelectCountry,
}: TerritoryFillsLayerProps) {
  return (
    <>
      {countries.map((country) => {
        const isSelected = country.id === selectedCountryId;
        return (
          <Group key={`fill-${country.id}`}>
            <CountryTerritoryShape
              country={country}
              isSelected={isSelected}
              onSelect={() => onSelectCountry?.(country.id)}
            />
          </Group>
        );
      })}
    </>
  );
}
