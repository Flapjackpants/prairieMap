import { useEffect, useRef } from 'react';
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { CountryTerritory } from '../../types/project';
import { TerritoryLayer } from './TerritoryLayer';

export interface ExportFrameSnapshot {
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
  image: HTMLImageElement | null;
  countries: CountryTerritory[];
  dateTitle: string;
}

interface ExportFrameStageProps {
  snapshot: ExportFrameSnapshot | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export function ExportFrameStage({ snapshot, stageRef }: ExportFrameStageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    imageRef.current = snapshot?.image ?? null;
  }, [snapshot?.image]);

  if (!snapshot) return null;

  const scale = Math.min(
    snapshot.width / snapshot.mapWidth,
    snapshot.height / snapshot.mapHeight,
  );
  const offsetX = (snapshot.width - snapshot.mapWidth * scale) / 2;
  const offsetY = (snapshot.height - snapshot.mapHeight * scale) / 2;
  const dateLabel = snapshot.dateTitle.trim().toUpperCase();

  return (
    <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0" aria-hidden>
      <Stage ref={stageRef} width={snapshot.width} height={snapshot.height}>
        <Layer>
          <Rect width={snapshot.width} height={snapshot.height} fill="#121315" listening={false} />
          <Group x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
            {snapshot.image ? (
              <KonvaImage
                image={snapshot.image}
                width={snapshot.mapWidth}
                height={snapshot.mapHeight}
                listening={false}
              />
            ) : (
              <>
                <Rect
                  width={snapshot.mapWidth}
                  height={snapshot.mapHeight}
                  fill="#141418"
                  listening={false}
                />
                <Rect
                  width={snapshot.mapWidth}
                  height={snapshot.mapHeight}
                  stroke="#2a2a30"
                  strokeWidth={2}
                  dash={[12, 8]}
                  listening={false}
                />
              </>
            )}
            <TerritoryLayer
              countries={snapshot.countries}
              selectedCountryId={null}
              draftPoints={[]}
              draftColor="#00e5ff"
              cursorPoint={null}
              snapTarget={null}
              onSelectCountry={() => {}}
              onRemoveDraftAnchor={() => {}}
            />
          </Group>
          {dateLabel && (
            <>
              <Rect
                x={8}
                y={snapshot.height - 36}
                width={Math.min(snapshot.width - 16, dateLabel.length * 9 + 24)}
                height={28}
                fill="rgba(20,22,24,0.85)"
                listening={false}
              />
              <Text
                x={16}
                y={snapshot.height - 30}
                text={dateLabel}
                fontSize={14}
                fill="#00e5ff"
                fontFamily="JetBrains Mono, monospace"
                listening={false}
              />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
