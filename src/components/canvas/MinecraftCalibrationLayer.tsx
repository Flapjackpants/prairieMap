import { Circle, Group, Line, Text } from 'react-konva';
import { mapRadiusForScreenPx, mapStrokeWidthForScreenPx } from '../../utils/mapZoom';

interface CalibrationPointProps {
  x: number;
  y: number;
  label: string;
  color: string;
  scale: number;
}

function CalibrationPoint({ x, y, label, color, scale }: CalibrationPointProps) {
  const r = mapRadiusForScreenPx(6, scale);
  const stroke = mapStrokeWidthForScreenPx(2, scale);
  const fontSize = Math.max(10, 11 / scale);
  return (
    <Group x={x} y={y} listening={false}>
      <Line
        points={[-r * 1.4, 0, r * 1.4, 0]}
        stroke={color}
        strokeWidth={stroke}
        listening={false}
      />
      <Line
        points={[0, -r * 1.4, 0, r * 1.4]}
        stroke={color}
        strokeWidth={stroke}
        listening={false}
      />
      <Circle radius={r} stroke={color} strokeWidth={stroke} listening={false} />
      <Text
        text={label}
        x={r + 4 / scale}
        y={-fontSize / 2}
        fontSize={fontSize}
        fill={color}
        fontFamily="ui-monospace, monospace"
        listening={false}
      />
    </Group>
  );
}

interface MinecraftCalibrationLayerProps {
  pointA: { mapX: number; mapY: number } | null;
  pointB: { mapX: number; mapY: number } | null;
  viewportScale: number;
}

export function MinecraftCalibrationLayer({
  pointA,
  pointB,
  viewportScale,
}: MinecraftCalibrationLayerProps) {
  if (!pointA && !pointB) return null;
  return (
    <>
      {pointA && (
        <CalibrationPoint
          x={pointA.mapX}
          y={pointA.mapY}
          label="A"
          color="#00e5ff"
          scale={viewportScale}
        />
      )}
      {pointB && (
        <CalibrationPoint
          x={pointB.mapX}
          y={pointB.mapY}
          label="B"
          color="#ffc400"
          scale={viewportScale}
        />
      )}
    </>
  );
}
