import { Line, Shape } from 'react-konva';
import { memo, useRef, type RefObject } from 'react';
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

/** Fill hit target — does not depend on selection or border width. */
const CountryTerritoryFill = memo(
  function CountryTerritoryFill({
    country,
    onSelectRef,
  }: {
    country: CountryTerritory;
    onSelectRef: RefObject<() => void>;
  }) {
    return (
      <Shape
        fill={country.color}
        fillRule="evenodd"
        opacity={TERRITORY_FILL_OPACITY}
        listening
        perfectDrawEnabled={false}
        onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
          if (e.evt.button !== 0) return;
          onSelectRef.current?.();
        }}
        sceneFunc={(context, shape) => {
          context.beginPath();
          fillRings(context, country.regions);
          context.fillStrokeShape(shape);
        }}
      />
    );
  },
  (prev, next) => prev.country === next.country,
);

/** Outline rings — only re-render when selection highlight or width changes. */
const CountryTerritoryOutline = memo(
  function CountryTerritoryOutline({
    countryId,
    regions,
    color,
    strokeWidth,
  }: {
    countryId: string;
    regions: CountryTerritory['regions'];
    color: string;
    strokeWidth: number;
  }) {
    const outline = adjustOutlineColor(color, -32);
    return (
      <>
        {regions.map((ring, ri) => (
          <Line
            key={`${countryId}-outline-${ri}`}
            points={ringToFlatPoints(ring)}
            closed
            stroke={outline}
            strokeWidth={strokeWidth}
            lineJoin="round"
            lineCap="round"
            fillEnabled={false}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}
      </>
    );
  },
  (prev, next) =>
    prev.countryId === next.countryId &&
    prev.regions === next.regions &&
    prev.color === next.color &&
    prev.strokeWidth === next.strokeWidth,
);

export const CountryTerritoryShape = memo(
  function CountryTerritoryShape({
    country,
    isSelected,
    onSelect,
    outlineWidth = TERRITORY_OUTLINE_WIDTH,
  }: CountryTerritoryShapeProps) {
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const strokeWidth = isSelected ? outlineWidth + 1 : outlineWidth;

    return (
      <>
        <CountryTerritoryFill country={country} onSelectRef={onSelectRef} />
        <CountryTerritoryOutline
          countryId={country.id}
          regions={country.regions}
          color={country.color}
          strokeWidth={strokeWidth}
        />
      </>
    );
  },
  (prev, next) =>
    prev.country === next.country &&
    prev.isSelected === next.isSelected &&
    prev.outlineWidth === next.outlineWidth,
);
