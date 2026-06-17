import { Group } from 'react-konva';
import { memo, useCallback } from 'react';
import type { CountryTerritory, PaletteColor } from '../../types/project';
import { TERRITORY_OUTLINE_WIDTH } from '../../types/project';
import type { TerritoryDisplayMode } from '../../types/displaySettings';
import { CountryTerritoryShape } from './CountryTerritoryShape';
import { CountryTerritoryFlagFill } from './CountryTerritoryFlagFill';
import { flagImageForFaction } from '../../hooks/useFlagImageMap';

interface TerritoryFillItemProps {
  country: CountryTerritory;
  isSelected: boolean;
  outlineWidth?: number;
  displayMode: TerritoryDisplayMode;
  palette: PaletteColor[];
  flagImageMap: Record<string, HTMLImageElement>;
  onSelectCountry?: (id: string) => void;
}

const TerritoryFillItem = memo(
  function TerritoryFillItem({
    country,
    isSelected,
    outlineWidth,
    displayMode,
    palette,
    flagImageMap,
    onSelectCountry,
  }: TerritoryFillItemProps) {
    const onSelect = useCallback(() => {
      onSelectCountry?.(country.id);
    }, [country.id, onSelectCountry]);

    const width = outlineWidth ?? TERRITORY_OUTLINE_WIDTH;
    const flagImage = flagImageForFaction(palette, flagImageMap, country.factionId);

    return (
      <Group>
        {displayMode === 'flag' ? (
          <CountryTerritoryFlagFill
            country={country}
            isSelected={isSelected}
            outlineWidth={width}
            flagImage={flagImage}
            onSelect={onSelect}
          />
        ) : (
          <CountryTerritoryShape
            country={country}
            isSelected={isSelected}
            outlineWidth={width}
            onSelect={onSelect}
          />
        )}
      </Group>
    );
  },
  (prev, next) =>
    prev.country === next.country &&
    prev.isSelected === next.isSelected &&
    prev.outlineWidth === next.outlineWidth &&
    prev.displayMode === next.displayMode &&
    prev.palette === next.palette &&
    prev.flagImageMap === next.flagImageMap &&
    prev.onSelectCountry === next.onSelectCountry,
);

interface TerritoryFillsLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  onSelectCountry?: (id: string) => void;
  outlineWidth?: number;
  displayMode?: TerritoryDisplayMode;
  palette?: PaletteColor[];
  flagImageMap?: Record<string, HTMLImageElement>;
}

/** Territory fills/outlines only (no labels or handles). */
export const TerritoryFillsLayer = memo(function TerritoryFillsLayer({
  countries,
  selectedCountryId,
  onSelectCountry,
  outlineWidth,
  displayMode = 'color',
  palette = [],
  flagImageMap = {},
}: TerritoryFillsLayerProps) {
  return (
    <>
      {countries.map((country) => (
        <TerritoryFillItem
          key={`fill-${country.id}`}
          country={country}
          isSelected={country.id === selectedCountryId}
          outlineWidth={outlineWidth}
          displayMode={displayMode}
          palette={palette}
          flagImageMap={flagImageMap}
          onSelectCountry={onSelectCountry}
        />
      ))}
    </>
  );
});
