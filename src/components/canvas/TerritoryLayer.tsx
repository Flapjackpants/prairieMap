import { Circle, Group, Line } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import type { SnapVertex } from '../../utils/vertexSnap';
import { CountryTerritoryShape } from './CountryTerritoryShape';
import { FlatRegionLabels } from './FlatRegionLabels';

interface TerritoryLayerProps {
  countries: CountryTerritory[];
  selectedCountryId: string | null;
  draftPoints: { x: number; y: number }[];
  draftColor: string;
  cursorPoint: { x: number; y: number } | null;
  snapTarget: SnapVertex | null;
  onSelectCountry: (id: string) => void;
  onRemoveDraftAnchor: (index: number) => void;
}

export function TerritoryLayer({
  countries,
  selectedCountryId,
  draftPoints,
  draftColor,
  cursorPoint,
  snapTarget,
  onSelectCountry,
  onRemoveDraftAnchor,
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
            <CountryTerritoryShape
              country={country}
              isSelected={isSelected}
              onSelect={() => onSelectCountry(country.id)}
            />
            {country.regions.length > 0 && <FlatRegionLabels country={country} />}
          </Group>
        );
      })}

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
