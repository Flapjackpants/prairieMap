import { Circle, Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CityMarker, DivisionMarker, MarkerKind } from '../../types/project';
import { DEFAULT_CITY_MARKER_SIZE } from '../../types/project';
import { useMarkerSourceImage } from '../../hooks/useMarkerSourceImage';

const LABEL_FONT = 'JetBrains Mono, monospace';

interface MarkerLayerProps {
  cities: CityMarker[];
  divisions: DivisionMarker[];
  selectedMarkerId: string | null;
  selectedMarkerKind: MarkerKind | null;
  interactive: boolean;
  onSelectMarker: (id: string, kind: MarkerKind) => void;
  onMoveCity: (id: string, x: number, y: number) => void;
  onMoveDivision: (id: string, x: number, y: number) => void;
}

function DivisionMarkerNode({
  marker,
  isSelected,
  interactive,
  onSelect,
  onMove,
}: {
  marker: DivisionMarker;
  isSelected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const image = useMarkerSourceImage(marker.sourceFilename);
  const half = marker.size / 2;

  return (
    <Group
      x={marker.x}
      y={marker.y}
      draggable={interactive}
      onDragEnd={(e) => {
        const node = e.target;
        onMove(node.x(), node.y());
      }}
      onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.evt.button !== 0) return;
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {image && marker.crop.width > 0 && marker.crop.height > 0 ? (
        <KonvaImage
          image={image}
          x={-half}
          y={-half}
          width={marker.size}
          height={marker.size}
          crop={{
            x: marker.crop.x,
            y: marker.crop.y,
            width: marker.crop.width,
            height: marker.crop.height,
          }}
        />
      ) : (
        <Rect
          x={-half}
          y={-half}
          width={marker.size}
          height={marker.size}
          fill="#888"
          stroke="#fff"
          strokeWidth={1}
        />
      )}
      <Rect
        x={-half}
        y={-half}
        width={marker.size}
        height={marker.size}
        stroke={isSelected ? '#00e5ff' : '#ffffff'}
        strokeWidth={isSelected ? 2 : 1}
        dash={isSelected ? [4, 4] : undefined}
        listening={false}
      />
    </Group>
  );
}

export function MarkerLayer({
  cities,
  divisions,
  selectedMarkerId,
  selectedMarkerKind,
  interactive,
  onSelectMarker,
  onMoveCity,
  onMoveDivision,
}: MarkerLayerProps) {
  const citySize = DEFAULT_CITY_MARKER_SIZE;
  const halfCity = citySize / 2;

  return (
    <>
      {cities.map((city) => {
        const isSelected = selectedMarkerKind === 'city' && selectedMarkerId === city.id;
        return (
          <Group
            key={`city-${city.id}`}
            x={city.x}
            y={city.y}
            draggable={interactive}
            onDragEnd={(e) => {
              const node = e.target;
              onMoveCity(city.id, node.x(), node.y());
            }}
            onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
              if (e.evt.button !== 0) return;
              e.cancelBubble = true;
              onSelectMarker(city.id, 'city');
            }}
          >
            <Circle
              radius={halfCity}
              fill="#ffffff"
              stroke={isSelected ? '#00e5ff' : '#2a2a30'}
              strokeWidth={isSelected ? 2 : 1.5}
            />
            <Text
              x={-60}
              y={halfCity + 4}
              width={120}
              align="center"
              text={city.name}
              fontFamily={LABEL_FONT}
              fontSize={11}
              fill="#f0f0f2"
              listening={false}
            />
          </Group>
        );
      })}
      {divisions.map((division) => (
        <DivisionMarkerNode
          key={`div-${division.id}`}
          marker={division}
          isSelected={selectedMarkerKind === 'division' && selectedMarkerId === division.id}
          interactive={interactive}
          onSelect={() => onSelectMarker(division.id, 'division')}
          onMove={(x, y) => onMoveDivision(division.id, x, y)}
        />
      ))}
    </>
  );
}
