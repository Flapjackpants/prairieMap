import { Group, Image as KonvaImage, Shape } from 'react-konva';
import { memo, useRef } from 'react';
import type Konva from 'konva';
import type { CountryTerritory } from '../../types/project';
import { TERRITORY_FILL_OPACITY } from '../../types/project';
import { ringToFlatPoints } from '../../utils/territoryGeometry';
import { CountryTerritoryOutline } from './CountryTerritoryShape';

function clipRings(
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

function regionsBoundingBox(regions: CountryTerritory['regions']) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of regions) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function containImageRect(
  bbox: { x: number; y: number; width: number; height: number },
  image: HTMLImageElement,
) {
  if (bbox.width <= 0 || bbox.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }
  const imageAspect = image.width / image.height;
  const boxAspect = bbox.width / bbox.height;
  let width: number;
  let height: number;
  if (imageAspect > boxAspect) {
    height = bbox.height;
    width = height * imageAspect;
  } else {
    width = bbox.width;
    height = width / imageAspect;
  }
  return {
    x: bbox.x + (bbox.width - width) / 2,
    y: bbox.y + (bbox.height - height) / 2,
    width,
    height,
  };
}

interface CountryTerritoryFlagFillProps {
  country: CountryTerritory;
  isSelected: boolean;
  outlineWidth: number;
  flagImage: HTMLImageElement | null;
  onSelect: () => void;
}

export const CountryTerritoryFlagFill = memo(
  function CountryTerritoryFlagFill({
    country,
    isSelected,
    outlineWidth,
    flagImage,
    onSelect,
  }: CountryTerritoryFlagFillProps) {
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const strokeWidth = isSelected ? outlineWidth + 1 : outlineWidth;
    const bbox = regionsBoundingBox(country.regions);
    const imageRect = flagImage ? containImageRect(bbox, flagImage) : null;

    return (
      <>
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            clipRings(ctx, country.regions);
            ctx.clip();
          }}
        >
          {flagImage && imageRect ? (
            <KonvaImage
              image={flagImage}
              x={imageRect.x}
              y={imageRect.y}
              width={imageRect.width}
              height={imageRect.height}
              listening={false}
              perfectDrawEnabled={false}
            />
          ) : (
            <Shape
              fill={country.color}
              opacity={TERRITORY_FILL_OPACITY}
              listening={false}
              perfectDrawEnabled={false}
              sceneFunc={(context, shape) => {
                context.beginPath();
                clipRings(context, country.regions);
                context.fillStrokeShape(shape);
              }}
            />
          )}
        </Group>
        <Shape
          fill="transparent"
          listening
          perfectDrawEnabled={false}
          onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
            if (e.evt.button !== 0) return;
            onSelectRef.current?.();
          }}
          sceneFunc={(context, shape) => {
            context.beginPath();
            clipRings(context, country.regions);
            context.fillStrokeShape(shape);
          }}
        />
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
    prev.outlineWidth === next.outlineWidth &&
    prev.flagImage === next.flagImage,
);
