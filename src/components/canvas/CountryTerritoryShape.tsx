import type Konva from 'konva';
import { Group, Line, Shape } from 'react-konva';
import type { CountryTerritory, SelectedTerritory, TerritoryVariant } from '../../types/project';
import { TERRITORY_FILL_OPACITY, TERRITORY_OUTLINE_WIDTH } from '../../types/project';
import { extensionColorForCountry } from '../../utils/colorUtils';
import { adjustOutlineColor, ringToFlatPoints } from '../../utils/territoryGeometry';

interface CountryTerritoryShapeProps {
  country: CountryTerritory;
  isSelected: boolean;
  selectedTerritory: SelectedTerritory | null;
  ringSelectable: boolean;
  onSelectRing: (ringIndex: number, variant: TerritoryVariant) => void;
}

function fillSingleRing(
  context: {
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    closePath: () => void;
  },
  ring: CountryTerritory['regions'][0],
) {
  const pts = ringToFlatPoints(ring);
  if (pts.length < 6) return;
  context.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) {
    context.lineTo(pts[i], pts[i + 1]);
  }
  context.closePath();
}

function ringHighlighted(
  selectedTerritory: SelectedTerritory | null,
  countryId: string,
  ringIndex: number,
  variant: TerritoryVariant,
): boolean {
  return (
    selectedTerritory?.countryId === countryId &&
    selectedTerritory.ringIndex === ringIndex &&
    selectedTerritory.variant === variant
  );
}

/** One fill + outline per ring so primary and extension areas select independently. */
export function CountryTerritoryShape({
  country,
  isSelected,
  selectedTerritory,
  ringSelectable,
  onSelectRing,
}: CountryTerritoryShapeProps) {
  const outline = adjustOutlineColor(country.color, -32);
  const strokeWidth = isSelected ? TERRITORY_OUTLINE_WIDTH + 1 : TERRITORY_OUTLINE_WIDTH;
  const extensionRings = country.extensionRegions ?? [];
  const extensionFill = extensionColorForCountry(country.color, country.extensionColor);

  const clickRing =
    (ringIndex: number, variant: TerritoryVariant) =>
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;
      e.cancelBubble = true;
      onSelectRing(ringIndex, variant);
    };

  return (
    <>
      {country.regions.map((ring, ri) => {
        const hi = ringHighlighted(selectedTerritory, country.id, ri, 'primary');
        return (
          <Group key={`${country.id}-pri-${ri}`}>
            <Shape
              fill={country.color}
              opacity={TERRITORY_FILL_OPACITY}
              listening={ringSelectable}
              onClick={clickRing(ri, 'primary')}
              sceneFunc={(context, shape) => {
                context.beginPath();
                fillSingleRing(context, ring);
                context.fillStrokeShape(shape);
              }}
            />
            <Line
              points={ringToFlatPoints(ring)}
              closed
              stroke={hi ? '#00e5ff' : outline}
              strokeWidth={hi ? strokeWidth + 2 : strokeWidth}
              dash={hi ? [6, 4] : undefined}
              lineJoin="round"
              lineCap="round"
              fillEnabled={false}
              listening={false}
            />
          </Group>
        );
      })}
      {extensionRings.map((ring, ri) => {
        const hi = ringHighlighted(selectedTerritory, country.id, ri, 'extension');
        return (
          <Group key={`${country.id}-ext-${ri}`}>
            <Shape
              fill={extensionFill}
              opacity={TERRITORY_FILL_OPACITY * 0.85}
              listening={ringSelectable}
              onClick={clickRing(ri, 'extension')}
              sceneFunc={(context, shape) => {
                context.beginPath();
                fillSingleRing(context, ring);
                context.fillStrokeShape(shape);
              }}
            />
            <Line
              points={ringToFlatPoints(ring)}
              closed
              stroke={hi ? '#00e5ff' : extensionFill}
              strokeWidth={hi ? strokeWidth + 2 : strokeWidth - 0.5}
              dash={hi ? [6, 4] : [4, 6]}
              lineJoin="round"
              lineCap="round"
              fillEnabled={false}
              listening={false}
            />
          </Group>
        );
      })}
    </>
  );
}
