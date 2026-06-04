import { Circle, Group, Line } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import type { SnapVertex } from '../../utils/vertexSnap';
import { CountryTerritoryShape } from './CountryTerritoryShape';
import { CurvedRegionLabels } from './CurvedRegionLabels';

interface TerritoryLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  activeFactionId: string | null;
  showFills?: boolean;
  showLabels?: boolean;
  showAnchorHandles: boolean;
  draftPoints: { x: number; y: number }[];
  draftColor: string;
  cursorPoint: { x: number; y: number } | null;
  snapTarget: SnapVertex | null;
  onSelectCountry: (id: string) => void;
  onRemoveDraftAnchor: (index: number) => void;
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

export function TerritoryLayer({
  countries,
  selectedCountryId,
  activeFactionId,
  showFills = true,
  showLabels = true,
  showAnchorHandles,
  draftPoints,
  draftColor,
  cursorPoint,
  snapTarget,
  onSelectCountry,
  onRemoveDraftAnchor,
  onClaimAnchor,
  onRemoveTerritoryVertex,
  onMoveTerritoryVertex,
}: TerritoryLayerProps) {
  const previewPoints =
    cursorPoint && draftPoints.length > 0
      ? [...draftPoints, cursorPoint]
      : draftPoints;

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
              return (
                <Circle
                  key={`anchor-${country.id}-${ringIndex}-${vertexIndex}`}
                  x={x}
                  y={y}
                  radius={ownedByActive ? 7 : 6}
                  fill={country.color}
                  stroke={ownedByActive ? '#ffffff' : '#121214'}
                  strokeWidth={2}
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

      {snapTarget && (
        <Circle
          x={snapTarget.x}
          y={snapTarget.y}
          radius={8}
          stroke="#00e5ff"
          strokeWidth={2}
          fill="rgba(0,229,255,0.25)"
          listening={false}
        />
      )}

      {previewPoints.length > 0 && (
        <>
          <Line
            points={previewPoints.flatMap((p) => [p.x, p.y])}
            stroke={draftColor}
            strokeWidth={2}
            dash={[8, 6]}
            closed={false}
            listening={false}
          />
          {draftPoints.map((p, i) => (
            <Circle
              key={`draft-${i}`}
              x={p.x}
              y={p.y}
              radius={i === 0 ? 7 : 5}
              fill={i === 0 ? draftColor : '#121214'}
              stroke={
                snapTarget?.source === 'draft' && snapTarget.index === i
                  ? '#00e5ff'
                  : draftColor
              }
              strokeWidth={2}
              onClick={(e) => {
                e.cancelBubble = true;
                if (e.evt.altKey) onRemoveDraftAnchor(i);
              }}
            />
          ))}
        </>
      )}
    </>
  );
}
