import { Line, Shape } from 'react-konva';
import type Konva from 'konva';
import type { CountryTerritory } from '../../types/project';
import { TERRITORY_FILL_OPACITY, TERRITORY_OUTLINE_WIDTH } from '../../types/project';
import { adjustOutlineColor, ringToFlatPoints } from '../../utils/territoryGeometry';

interface CountryTerritoryShapeProps {
  country: CountryTerritory;
  isSelected: boolean;
  onSelect: () => void;
  outlineWidth?: number;
}

function fillRings(
  context: {
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    closePath: () => void;
  },
  rings: CountryTerritory['regions'],
) {
  for (const ring of rings) {
    const pts = ringToFlatPoints(ring);
    if (pts.length < 6) continue;
    context.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) {
      context.lineTo(pts[i], pts[i + 1]);
    }
    context.closePath();
  }
}

export function CountryTerritoryShape({
  country,
  isSelected,
  onSelect,
  outlineWidth = TERRITORY_OUTLINE_WIDTH,
}: CountryTerritoryShapeProps) {
  const outline = adjustOutlineColor(country.color, -32);
  const strokeWidth = isSelected ? outlineWidth + 1 : outlineWidth;

  return (
    <>
      <Shape
        fill={country.color}
        fillRule="evenodd"
        opacity={TERRITORY_FILL_OPACITY}
        listening
        onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
          if (e.evt.button !== 0) return;
          onSelect();
        }}
        sceneFunc={(context, shape) => {
          context.beginPath();
          fillRings(context, country.regions);
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
