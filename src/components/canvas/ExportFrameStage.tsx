import { useEffect, useRef } from 'react';
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type { CityMarker, CountryTerritory, DivisionMarker } from '../../types/project';
import {
  estimateEventLogLines,
  formatEventLogForExport,
} from '../../utils/formatEventLogExport';
import { TerritoryFillsLayer } from './TerritoryFillsLayer';
import { TerritoryLabelsLayer } from './TerritoryLabelsLayer';
import { MarkerLayer } from './MarkerLayer';

export interface ExportFrameSnapshot {
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
  image: HTMLImageElement | null;
  countries: CountryTerritory[];
  cities: CityMarker[];
  divisions: DivisionMarker[];
  dateTitle: string;
  eventLog: string;
  divisionImages?: Record<string, HTMLImageElement>;
}

interface ExportFrameStageProps {
  snapshot: ExportFrameSnapshot | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

const DOSSIER_FONT = 'JetBrains Mono, monospace';
const BODY_FONT_SIZE = 20;
const DATE_FONT_SIZE = 26;
const HEADER_FONT_SIZE = 14;
const PANEL_PADDING = 20;

function dossierPanelWidth(
  stageWidth: number,
  dateTitle: string,
  eventLog: string,
): number {
  const eventBody = formatEventLogForExport(eventLog);
  const hasDate = Boolean(dateTitle.trim());
  const hasLog = Boolean(eventBody);
  if (!hasDate && !hasLog) return 0;

  const panelFraction = 0.4;
  const minPanel = 100;
  const maxPanel = Math.round(stageWidth * 0.48);
  const innerWidth = Math.max(200, Math.round(stageWidth * panelFraction) - PANEL_PADDING * 2);
  const charsPerLine = Math.max(12, Math.floor(innerWidth / (BODY_FONT_SIZE * 0.55)));
  const bodyLines = estimateEventLogLines(eventBody, charsPerLine);

  const linePx = BODY_FONT_SIZE * 1.35;
  const wanted =
    PANEL_PADDING * 2 +
    (hasLog ? 28 : 0) +
    (hasDate ? DATE_FONT_SIZE + 16 : 0) +
    bodyLines * linePx;

  return Math.min(maxPanel, Math.max(minPanel, Math.round(stageWidth * panelFraction), wanted));
}

export function ExportFrameStage({ snapshot, stageRef }: ExportFrameStageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    imageRef.current = snapshot?.image ?? null;
  }, [snapshot?.image]);

  if (!snapshot) return null;

  const dateLabel = snapshot.dateTitle.trim().toUpperCase();
  const eventBody = formatEventLogForExport(snapshot.eventLog);
  const panelW = dossierPanelWidth(snapshot.width, dateLabel, eventBody);
  const mapAreaW = snapshot.width - panelW;
  const panelX = mapAreaW;

  const scale = Math.min(
    mapAreaW / snapshot.mapWidth,
    snapshot.height / snapshot.mapHeight,
  );
  const offsetX = (mapAreaW - snapshot.mapWidth * scale) / 2;
  const offsetY = (snapshot.height - snapshot.mapHeight * scale) / 2;

  const textWidth = panelW - PANEL_PADDING * 2;
  const headerY = PANEL_PADDING;
  const dateY = headerY + (eventBody ? 30 : 0);
  const bodyY = dateY + (dateLabel ? DATE_FONT_SIZE + 20 : 0);

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
            <TerritoryFillsLayer countries={snapshot.countries} selectedCountryId={null} />
            <MarkerLayer
              showCities={false}
              showDivisions
              divisions={snapshot.divisions}
              divisionImageMap={snapshot.divisionImages}
              selectedMarkerId={null}
              selectedMarkerKind={null}
              interactive={false}
              onSelectMarker={() => {}}
              onMoveCity={() => {}}
              onMoveDivision={() => {}}
            />
            <TerritoryLabelsLayer countries={snapshot.countries} />
            <MarkerLayer
              showDivisions={false}
              showCities
              cities={snapshot.cities}
              selectedMarkerId={null}
              selectedMarkerKind={null}
              interactive={false}
              onSelectMarker={() => {}}
              onMoveCity={() => {}}
              onMoveDivision={() => {}}
            />
          </Group>

          {panelW > 0 && (
            <>
              <Rect
                x={panelX}
                y={0}
                width={panelW}
                height={snapshot.height}
                fill="rgba(16,18,20,0.94)"
                listening={false}
              />
              <Rect
                x={panelX}
                y={0}
                width={2}
                height={snapshot.height}
                fill="#00e5ff"
                opacity={0.4}
                listening={false}
              />
              {eventBody && (
                <Text
                  x={panelX + PANEL_PADDING}
                  y={headerY}
                  text=":: EVENT_LOG ::"
                  fontSize={HEADER_FONT_SIZE}
                  fill="#8a8d94"
                  fontFamily={DOSSIER_FONT}
                  letterSpacing={1.5}
                  listening={false}
                />
              )}
              {dateLabel && (
                <Text
                  x={panelX + PANEL_PADDING}
                  y={dateY}
                  width={textWidth}
                  text={dateLabel}
                  fontSize={DATE_FONT_SIZE}
                  fill="#ff6b00"
                  fontStyle="bold"
                  fontFamily={DOSSIER_FONT}
                  wrap="word"
                  listening={false}
                />
              )}
              {eventBody && (
                <Text
                  x={panelX + PANEL_PADDING}
                  y={bodyY}
                  width={textWidth}
                  text={eventBody}
                  fontSize={BODY_FONT_SIZE}
                  lineHeight={1.35}
                  fill="rgba(0,229,255,0.95)"
                  fontFamily={DOSSIER_FONT}
                  wrap="word"
                  listening={false}
                />
              )}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
