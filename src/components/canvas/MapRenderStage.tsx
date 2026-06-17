import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type {
  CityMarker,
  CountryTerritory,
  DivisionMarker,
  PaletteColor,
  ProjectDisplaySettings,
} from '../../types/project';
import {
  estimateEventLogLines,
  formatEventLogForExport,
} from '../../utils/formatEventLogExport';
import type { FrameRenderOptions } from '../../types/renderOptions';
import { filterCountriesByVisibility } from '../../types/renderOptions';
import { TerritoryFillsLayer } from './TerritoryFillsLayer';
import { TerritoryLabelsLayer } from './TerritoryLabelsLayer';
import { MarkerLayer } from './MarkerLayer';

export interface MapRenderSnapshot {
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
  palette: PaletteColor[];
  displaySettings: ProjectDisplaySettings;
  divisionImages?: Record<string, HTMLImageElement>;
  flagImages?: Record<string, HTMLImageElement>;
}

interface MapRenderStageProps {
  snapshot: MapRenderSnapshot;
  renderOptions: FrameRenderOptions;
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

export function MapRenderStage({ snapshot, renderOptions, stageRef }: MapRenderStageProps) {
  const dateLabel = snapshot.dateTitle.trim().toUpperCase();
  const eventBody = formatEventLogForExport(snapshot.eventLog);
  const dossierContentW = dossierPanelWidth(snapshot.width, dateLabel, eventBody);
  const panelW =
    renderOptions.showDossier && dossierContentW > 0 ? dossierContentW : 0;
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

  const countries = filterCountriesByVisibility(
    snapshot.countries,
    renderOptions.visibleCountryIds,
  );
  const showLabels =
    renderOptions.showLabels && renderOptions.territoryDisplayMode === 'color';

  return (
    <Stage ref={stageRef} width={snapshot.width} height={snapshot.height}>
      <Layer>
        <Rect width={snapshot.width} height={snapshot.height} fill="#121315" listening={false} />
        <Group x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
          {renderOptions.showBackground &&
            (snapshot.image ? (
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
            ))}
          <TerritoryFillsLayer
            countries={countries}
            selectedCountryId={null}
            outlineWidth={snapshot.displaySettings.territoryBorderWidth}
            displayMode={renderOptions.territoryDisplayMode}
            palette={snapshot.palette}
            flagImageMap={snapshot.flagImages ?? {}}
          />
          {renderOptions.showDivisions && (
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
          )}
          <TerritoryLabelsLayer countries={countries} showLabels={showLabels} />
          {renderOptions.showCities && (
            <MarkerLayer
              showDivisions={false}
              showCities
              cities={snapshot.cities}
              cityTextSize={snapshot.displaySettings.cityTextSize}
              cityMarkerStrokeWidth={snapshot.displaySettings.cityMarkerStrokeWidth}
              selectedMarkerId={null}
              selectedMarkerKind={null}
              interactive={false}
              onSelectMarker={() => {}}
              onMoveCity={() => {}}
              onMoveDivision={() => {}}
            />
          )}
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
  );
}
