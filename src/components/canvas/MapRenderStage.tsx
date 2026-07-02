import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type {
  CityMarker,
  CountryTerritory,
  DivisionMarker,
  PaletteColor,
  ProjectDisplaySettings,
} from '../../types/project';
import { exportDossierMetrics } from '../../utils/dossierLayout';
import { prepareDossierEventLog } from '../../utils/formatEventLogExport';
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

export function MapRenderStage({ snapshot, renderOptions, stageRef }: MapRenderStageProps) {
  const dateLabel = snapshot.dateTitle.trim();
  const dossier = exportDossierMetrics(snapshot.width, snapshot.height);
  const eventBody = prepareDossierEventLog(snapshot.eventLog, dossier.charsPerLine);
  const hasDossierContent = Boolean(dateLabel || eventBody);
  const panelW =
    renderOptions.showDossier && hasDossierContent ? dossier.panelW : 0;
  const mapAreaW = snapshot.width - panelW;
  const panelX = mapAreaW;

  const scale = Math.min(
    mapAreaW / snapshot.mapWidth,
    snapshot.height / snapshot.mapHeight,
  );
  const offsetX = (mapAreaW - snapshot.mapWidth * scale) / 2;
  const offsetY = (snapshot.height - snapshot.mapHeight * scale) / 2;

  const textWidth = panelW - dossier.padding * 2;
  let cursorY = dossier.padding;
  const dateBoxY = cursorY;
  if (dateLabel) {
    cursorY += dossier.dateFontSize + dossier.padding + 8;
  }
  const eventHeaderY = dateLabel ? cursorY : dossier.padding;
  const eventBodyY = eventHeaderY + (eventBody ? dossier.headerFontSize + 8 : 0);

  const countries = filterCountriesByVisibility(
    snapshot.countries,
    renderOptions.visibleCountryIds,
  );
  const showLabels =
    renderOptions.showLabels && renderOptions.territoryDisplayMode === 'color';
  const opaqueStageBackdrop = renderOptions.showBackground;

  return (
    <Stage ref={stageRef} width={snapshot.width} height={snapshot.height}>
      <Layer>
        {opaqueStageBackdrop && (
          <Rect width={snapshot.width} height={snapshot.height} fill="#121315" listening={false} />
        )}
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
              fill="rgba(12,13,16,0.96)"
              listening={false}
            />
            <Rect
              x={panelX}
              y={0}
              width={1}
              height={snapshot.height}
              fill="#00e5ff"
              opacity={0.35}
              listening={false}
            />
            {dateLabel && (
              <Rect
                x={panelX + dossier.padding}
                y={dateBoxY}
                width={textWidth}
                height={dossier.dateFontSize + dossier.padding}
                stroke="rgba(0,229,255,0.35)"
                strokeWidth={1}
                listening={false}
              />
            )}
            {dateLabel && (
              <Text
                x={panelX + dossier.padding + 6}
                y={dateBoxY + 5}
                width={textWidth - 12}
                text={dateLabel}
                fontSize={dossier.dateFontSize}
                fill="#e8eaed"
                fontStyle="bold"
                fontFamily={DOSSIER_FONT}
                wrap="word"
                listening={false}
              />
            )}
            {eventBody && (
              <>
                <Text
                  x={panelX + dossier.padding}
                  y={eventHeaderY}
                  text=":: EVENT_LOG ::"
                  fontSize={dossier.headerFontSize}
                  fill="#6b6f78"
                  fontFamily={DOSSIER_FONT}
                  letterSpacing={1}
                  listening={false}
                />
                <Rect
                  x={panelX + dossier.padding}
                  y={eventBodyY - 4}
                  width={textWidth}
                  height={Math.max(
                    48,
                    snapshot.height - eventBodyY - dossier.padding,
                  )}
                  stroke="rgba(0,229,255,0.22)"
                  strokeWidth={1}
                  fill="rgba(0,229,255,0.03)"
                  listening={false}
                />
                <Text
                  x={panelX + dossier.padding + 6}
                  y={eventBodyY + 2}
                  width={textWidth - 12}
                  height={snapshot.height - eventBodyY - dossier.padding - 8}
                  text={eventBody}
                  fontSize={dossier.bodyFontSize}
                  lineHeight={dossier.lineHeight}
                  fill="rgba(0,229,255,0.92)"
                  fontFamily={DOSSIER_FONT}
                  wrap="word"
                  listening={false}
                />
              </>
            )}
          </>
        )}
      </Layer>
    </Stage>
  );
}
