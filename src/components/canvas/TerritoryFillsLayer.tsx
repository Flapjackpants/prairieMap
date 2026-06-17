import { Group } from 'react-konva';
import { memo, useCallback } from 'react';
import type { CountryTerritory } from '../../types/project';
import { CountryTerritoryShape } from './CountryTerritoryShape';

interface TerritoryFillItemProps {
  country: CountryTerritory;
  isSelected: boolean;
  outlineWidth?: number;
  onSelectCountry?: (id: string) => void;
}

const TerritoryFillItem = memo(
  function TerritoryFillItem({
    country,
    isSelected,
    outlineWidth,
    onSelectCountry,
  }: TerritoryFillItemProps) {
    const onSelect = useCallback(() => {
      onSelectCountry?.(country.id);
    }, [country.id, onSelectCountry]);

    return (
      <Group>
        <CountryTerritoryShape
          country={country}
          isSelected={isSelected}
          outlineWidth={outlineWidth}
          onSelect={onSelect}
        />
      </Group>
    );
  },
  (prev, next) =>
    prev.country === next.country &&
    prev.isSelected === next.isSelected &&
    prev.outlineWidth === next.outlineWidth &&
    prev.onSelectCountry === next.onSelectCountry,
);

interface TerritoryFillsLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  onSelectCountry?: (id: string) => void;
  outlineWidth?: number;
}

/** Territory fills/outlines only (no labels or handles). */
export const TerritoryFillsLayer = memo(function TerritoryFillsLayer({
  countries,
  selectedCountryId,
  onSelectCountry,
  outlineWidth,
}: TerritoryFillsLayerProps) {
  return (
    <>
      {countries.map((country) => (
        <TerritoryFillItem
          key={`fill-${country.id}`}
          country={country}
          isSelected={country.id === selectedCountryId}
          outlineWidth={outlineWidth}
          onSelectCountry={onSelectCountry}
        />
      ))}
    </>
  );
});
