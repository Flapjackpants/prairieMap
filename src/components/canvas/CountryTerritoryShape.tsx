import { Line, Shape } from 'react-konva';
import type { CountryTerritory } from '../../types/project';
import { TERRITORY_FILL_OPACITY, TERRITORY_OUTLINE_WIDTH } from '../../types/project';
import { adjustOutlineColor, ringToFlatPoints } from '../../utils/territoryGeometry';

interface CountryTerritoryShapeProps {
  country: CountryTerritory;
  isSelected: boolean;
  onSelect: () => void;
}

/** Single compound fill so overlapping same-nation regions do not stack opacity. */
export function CountryTerritoryShape({
  country,
  isSelected,
  onSelect,
}: CountryTerritoryShapeProps) {
  const outline = adjustOutlineColor(country.color, -32);
  const strokeWidth = isSelected ? TERRITORY_OUTLINE_WIDTH + 1 : TERRITORY_OUTLINE_WIDTH;

  return (
    <>
      <Shape
        fill={country.color}
        opacity={TERRITORY_FILL_OPACITY}
        listening
        onClick={onSelect}
        sceneFunc={(context, shape) => {
          context.beginPath();
          for (const ring of country.regions) {
            const pts = ringToFlatPoints(ring);
            if (pts.length < 6) continue;
            context.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) {
              context.lineTo(pts[i], pts[i + 1]);
            }
            context.closePath();
          }
          context.fillStrokeShape(shape);
        }}
      />
      {country.regions.map((ring, ri) => (
        <Line
          key={`${country.id}-outline-${ri}`}
          points={ringToFlatPoints(ring)}
          closed
          stroke={outline}
          strokeWidth={strokeWidth}
          lineJoin="round"
          lineCap="round"
          fillEnabled={false}
          listening={false}
        />
      ))}
    </>
  );
}
