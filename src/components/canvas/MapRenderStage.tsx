import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import type {
  CityMarker,
  CountryTerritory,
  DivisionMarker,
  PaletteColor,
  ProjectDisplaySettings,
} from '../../types/project';
import { sortDivisionsByIconFile } from '../../utils/activeDivisions';
import { exportDossierMetrics, shouldShowDossierPanel } from '../../utils/dossierLayout';
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
  activeDivisions: DivisionMarker[];
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
const SECTION_GAP = 8;

function ActiveDivisionRow({
  division,
  x,
  y,
  iconSize,
  textWidth,
  fontSize,
  divisionImages,
}: {
  division: DivisionMarker;
  x: number;
  y: number;
  iconSize: number;
  textWidth: number;
  fontSize: number;
  divisionImages?: Record<string, HTMLImageElement>;
}) {
  const image = divisionImages?.[division.sourceFilename] ?? null;
  const { crop } = division;
  const label = division.name.trim() || 'Unknown';
  const textX = x + iconSize + 6;
  const textW = Math.max(20, textWidth - iconSize - 6);

  return (
    <>
      {image && crop.width > 0 && crop.height > 0 ? (
        <KonvaImage
          x={x}
          y={y}
          width={iconSize}
          height={iconSize}
          image={image}
          crop={{ x: crop.x, y: crop.y, width: crop.width, height: crop.height }}
          listening={false}
        />
      ) : (
        <Rect
          x={x}
          y={y}
          width={iconSize}
          height={iconSize}
          fill="#2a2a30"
          stroke="#4a4a52"
          strokeWidth={1}
          listening={false}
        />
      )}
      <Text
        x={textX}
        y={y + 2}
        width={textW}
        text={label}
        fontSize={fontSize}
        lineHeight={1.25}
        fill="#c8cad0"
        fontFamily={DOSSIER_FONT}
        wrap="word"
        listening={false}
      />
    </>
  );
}

export function MapRenderStage({ snapshot, renderOptions, stageRef }: MapRenderStageProps) {
  const dateLabel = snapshot.dateTitle.trim();
  const dossier = exportDossierMetrics(snapshot.width, snapshot.height, renderOptions.layout);
  const eventBody = prepareDossierEventLog(snapshot.eventLog, dossier.charsPerLine);
  const activeDivisions =
    renderOptions.showActiveDivisions && renderOptions.showDossier
      ? sortDivisionsByIconFile(snapshot.activeDivisions)
      : [];
  const hasActiveDivisions = activeDivisions.length > 0;
  const showPanel = shouldShowDossierPanel(
    renderOptions.showDossier,
    dateLabel,
    eventBody,
    hasActiveDivisions ? activeDivisions.length : 0,
  );
  const panelW = showPanel ? dossier.panelW : 0;
  const mapAreaW = snapshot.width - panelW;
  const panelX = mapAreaW;

  const baseScale = Math.min(
    mapAreaW / snapshot.mapWidth,
    snapshot.height / snapshot.mapHeight,
  );
  const scale = baseScale * renderOptions.layout.mapScale;
  const offsetX = (mapAreaW - snapshot.mapWidth * scale) / 2;
  const offsetY = (snapshot.height - snapshot.mapHeight * scale) / 2;

  const textWidth = panelW - dossier.padding * 2;
  const rowFontSize = Math.max(8, dossier.bodyFontSize - 1);
  const rowHeight = dossier.activeDivisionsIconSize + 6;

  let activeDivSectionH = 0;
  if (hasActiveDivisions) {
    activeDivSectionH =
      dossier.headerFontSize + SECTION_GAP + activeDivisions.length * rowHeight + dossier.padding;
  }

  let dateSectionH = 0;
  if (dateLabel) {
    dateSectionH =
      dossier.headerFontSize + SECTION_GAP + dossier.dateFontSize + dossier.padding + SECTION_GAP;
  }

  const eventHeaderH = eventBody ? dossier.headerFontSize + SECTION_GAP : 0;
  const topFixed = dossier.padding + dateSectionH + eventHeaderH;
  const eventBodyH = eventBody
    ? Math.max(48, snapshot.height - topFixed - activeDivSectionH - dossier.padding)
    : 0;

  let cursorY = dossier.padding;
  const dateHeaderY = dateLabel ? cursorY : 0;
  if (dateLabel) {
    cursorY += dossier.headerFontSize + SECTION_GAP;
  }
  const dateBoxY = dateLabel ? cursorY : 0;
  if (dateLabel) {
    cursorY += dossier.dateFontSize + dossier.padding + SECTION_GAP;
  }

  const eventHeaderY = eventBody ? cursorY : 0;
  if (eventBody) {
    cursorY += eventHeaderH;
  }
  const eventBodyY = eventBody ? cursorY : 0;
  if (eventBody) {
    cursorY += eventBodyH + SECTION_GAP;
  }

  const activeDivHeaderY = hasActiveDivisions ? cursorY : 0;
  if (hasActiveDivisions) {
    cursorY += dossier.headerFontSize + SECTION_GAP;
  }

  const maxVisibleDivisions = hasActiveDivisions
    ? Math.max(
        0,
        Math.floor(
          (snapshot.height - activeDivHeaderY - dossier.headerFontSize - SECTION_GAP - dossier.padding) /
            rowHeight,
        ),
      )
    : 0;
  const visibleDivisions = activeDivisions.slice(0, maxVisibleDivisions);
  const truncatedDivisionCount = activeDivisions.length - visibleDivisions.length;

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
              <>
                <Text
                  x={panelX + dossier.padding}
                  y={dateHeaderY}
                  text=":: DATE_ERA ::"
                  fontSize={dossier.headerFontSize}
                  fill="#6b6f78"
                  fontFamily={DOSSIER_FONT}
                  letterSpacing={1}
                  listening={false}
                />
                <Rect
                  x={panelX + dossier.padding}
                  y={dateBoxY}
                  width={textWidth}
                  height={dossier.dateFontSize + dossier.padding}
                  stroke="rgba(0,229,255,0.35)"
                  strokeWidth={1}
                  listening={false}
                />
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
              </>
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
                  height={eventBodyH}
                  stroke="rgba(0,229,255,0.22)"
                  strokeWidth={1}
                  fill="rgba(0,229,255,0.03)"
                  listening={false}
                />
                <Text
                  x={panelX + dossier.padding + 6}
                  y={eventBodyY + 2}
                  width={textWidth - 12}
                  height={eventBodyH - 8}
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

            {hasActiveDivisions && (
              <>
                <Text
                  x={panelX + dossier.padding}
                  y={activeDivHeaderY}
                  text=":: ACTIVE_DIVISIONS ::"
                  fontSize={dossier.headerFontSize}
                  fill="#6b6f78"
                  fontFamily={DOSSIER_FONT}
                  letterSpacing={1}
                  listening={false}
                />
                {visibleDivisions.map((division, index) => (
                  <ActiveDivisionRow
                    key={division.id}
                    division={division}
                    x={panelX + dossier.padding}
                    y={activeDivHeaderY + dossier.headerFontSize + SECTION_GAP + index * rowHeight}
                    iconSize={dossier.activeDivisionsIconSize}
                    textWidth={textWidth}
                    fontSize={rowFontSize}
                    divisionImages={snapshot.divisionImages}
                  />
                ))}
                {truncatedDivisionCount > 0 && (
                  <Text
                    x={panelX + dossier.padding}
                    y={
                      activeDivHeaderY +
                      dossier.headerFontSize +
                      SECTION_GAP +
                      visibleDivisions.length * rowHeight
                    }
                    text={`… ${truncatedDivisionCount} more`}
                    fontSize={rowFontSize}
                    fill="#6b6f78"
                    fontFamily={DOSSIER_FONT}
                    listening={false}
                  />
                )}
              </>
            )}
          </>
        )}
      </Layer>
    </Stage>
  );
}
