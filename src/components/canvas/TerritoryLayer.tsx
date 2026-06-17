import { Circle, Group } from 'react-konva';
import { memo } from 'react';
import type { CountryTerritory } from '../../types/project';
import {
  ANCHOR_HIT_SCREEN_PX,
  hitStrokeWidthForScreenPx,
  mapRadiusForScreenPx,
  mapStrokeWidthForScreenPx,
} from '../../utils/mapZoom';
import { CountryTerritoryShape } from './CountryTerritoryShape';
import { CurvedRegionLabels } from './CurvedRegionLabels';

interface TerritoryLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  activeFactionId: string | null;
  viewportScale?: number;
  showFills?: boolean;
  showLabels?: boolean;
  showAnchorHandles: boolean;
  outlineWidth?: number;
  onSelectCountry: (id: string) => void;
  onClaimAnchor: (x: number, y: number) => void;
  onRemoveTerritoryVertex: (countryId: string, ringIndex: number, vertexIndex: number) => void;
  onMoveTerritoryVertex: (
    countryId: string,
    ringIndex: number,
    vertexIndex: number,
    x: number,
    y: number,
  ) => void;
}

export const TerritoryLayer = memo(function TerritoryLayer({
  countries,
  selectedCountryId,
  activeFactionId,
  viewportScale = 1,
  showFills = true,
  showLabels = true,
  showAnchorHandles,
  outlineWidth,
  onSelectCountry,
  onClaimAnchor,
  onRemoveTerritoryVertex,
  onMoveTerritoryVertex,
}: TerritoryLayerProps) {
  const scale = viewportScale;
  const anchorRadius = (screenPx: number) => mapRadiusForScreenPx(screenPx, scale);
  const anchorStroke = mapStrokeWidthForScreenPx(2, scale);
  const anchorHit = (mapRadius: number) =>
    hitStrokeWidthForScreenPx(ANCHOR_HIT_SCREEN_PX, mapRadius, scale);

  return (
    <>
      {countries.map((country) => {
        const isSelected = country.id === selectedCountryId;

        return (
          <Group key={country.id}>
            {showFills && (
              <CountryTerritoryShape
                country={country}
                isSelected={isSelected}
                outlineWidth={outlineWidth}
                onSelect={() => onSelectCountry(country.id)}
              />
            )}
            {showLabels && country.regions.length > 0 && (
              <CurvedRegionLabels country={country} allCountries={countries} />
            )}
          </Group>
        );
      })}

      {showAnchorHandles &&
        countries.map((country) =>
          country.regions.map((ring, ringIndex) =>
            ring.map(([x, y], vertexIndex) => {
              const ownedByActive = country.factionId === activeFactionId;
              const radius = anchorRadius(ownedByActive ? 7 : 6);
              return (
                <Circle
                  key={`anchor-${country.id}-${ringIndex}-${vertexIndex}`}
                  x={x}
                  y={y}
                  radius={radius}
                  fill={country.color}
                  stroke={ownedByActive ? '#ffffff' : '#121214'}
                  strokeWidth={anchorStroke}
                  hitStrokeWidth={anchorHit(radius)}
                  opacity={ownedByActive ? 1 : 0.85}
                  draggable
                  onDragEnd={(e) => {
                    const node = e.target;
                    onMoveTerritoryVertex(
                      country.id,
                      ringIndex,
                      vertexIndex,
                      node.x(),
                      node.y(),
                    );
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (e.evt.altKey) {
                      onRemoveTerritoryVertex(country.id, ringIndex, vertexIndex);
                      return;
                    }
                    onClaimAnchor(x, y);
                  }}
                />
              );
            }),
          ),
        )}

    </>
  );
});
