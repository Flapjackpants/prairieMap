import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import type Konva from 'konva';
import { AlertTriangle, Map } from 'lucide-react';
import { useLocalDisplaySettings } from '../../context/LocalDisplaySettingsContext';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { normalizeClosedRing } from '../../utils/territoryGeometry';
import { SNAP_THRESHOLD_PX } from '../../types/project';
import { isEditableTarget } from '../../utils/editableTarget';
import { collectSnapVertices, findSnapTarget, type SnapVertex } from '../../utils/vertexSnap';
import { useMapImageUrl } from '../../hooks/useMapImageUrl';
import { CanvasToolbar } from './CanvasToolbar';
import { PlaybackControls } from './PlaybackControls';
import { TerritoryLayer } from './TerritoryLayer';
import { TerritoryFillsLayer } from './TerritoryFillsLayer';
import { TerritoryLabelsLayer } from './TerritoryLabelsLayer';
import { MarkerLayer } from './MarkerLayer';
import { CityNameModal } from './CityNameModal';
import { DivisionCropModal } from './DivisionCropModal';
import { DisplaySettingsPanel } from '../settings/DisplaySettingsPanel';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const MIN_POLYGON_POINTS = 3;

function useLoadedImage(url: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url]);

  return image;
}

export function MapCanvas() {
  const {
    state,
    currentFrame,
    activeColor,
    setViewport,
    addTerritoryRegion,
    claimAnchor,
    removeTerritoryVertex,
    moveTerritoryVertex,
    setSelectedCountry,
    setSelectedMarker,
    addCityMarker,
    addDivisionMarker,
    updateCityMarker,
    updateDivisionMarker,
    setFileCanvasSize,
  } = useProject();
  const { settings: displaySettings } = useLocalDisplaySettings();

  const { tool, viewport, selectedCountryId, activeColorId, selectedMarkerId, selectedMarkerKind } =
    state;
  const [cropDivisionId, setCropDivisionId] = useState<string | null>(null);
  const [pendingCityPlacement, setPendingCityPlacement] = useState<{ x: number; y: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([]);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapTarget, setSnapTarget] = useState<SnapVertex | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [middlePanHeld, setMiddlePanHeld] = useState(false);
  const middlePanRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const mapFile =
    currentFrame && !currentFrame.isMissing && !currentFrame.isBlank
      ? state.fileRegistry[currentFrame.filename]?.file ?? null
      : null;
  const mapImageUrl = useMapImageUrl(
    currentFrame && !currentFrame.isMissing && !currentFrame.isBlank
      ? currentFrame.filename
      : null,
    mapFile,
    Boolean(currentFrame && !currentFrame.isMissing && !currentFrame.isBlank && mapFile),
  );
  const image = useLoadedImage(mapImageUrl);
  const countries = currentFrame?.frameData.annotations.countries ?? [];
  const isMissing = currentFrame?.isMissing ?? false;
  const selectedCountry = countries.find((c) => c.id === selectedCountryId);

  /** Konva left-drag pan (PAN tool or Space). Middle-click uses manual viewport updates. */
  const isKonvaPanDrag = tool === 'pan' || spaceHeld;
  const isPointerPanning = isKonvaPanDrag || middlePanHeld;
  const isAreaSelect = tool === 'areaSelect' && !isPointerPanning;
  const draftColor = isAreaSelect
    ? activeColor?.hex ?? '#00e5ff'
    : selectedCountry?.color ?? activeColor?.hex ?? '#00e5ff';
  const isSelect = tool === 'select' && !isPointerPanning;
  const isCityTool = tool === 'city' && !isPointerPanning;
  const isDivisionTool = tool === 'division' && !isPointerPanning;
  const isPlacementTool = isCityTool || isDivisionTool;
  const isMarkerInteractive = (isSelect || isCityTool || isDivisionTool) && !isPointerPanning;
  const showAnchorHandles = (isAreaSelect || isSelect) && !isPointerPanning;
  const cities = currentFrame?.frameData.annotations.cities ?? [];
  const divisions = currentFrame?.frameData.annotations.divisions ?? [];
  const snapThreshold = SNAP_THRESHOLD_PX / Math.max(viewport.scale, 0.15);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setDraftPoints([]);
    setCursorPoint(null);
    setSnapTarget(null);
  }, [currentFrame?.entry.id]);

  useEffect(() => {
    if (tool !== 'city') setPendingCityPlacement(null);
  }, [tool]);

  const getPointerOnImage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }, []);

  const resolveSnap = useCallback(
    (raw: { x: number; y: number }, excludeDraftIndex?: number) => {
      const verts = collectSnapVertices(countries, draftPoints, excludeDraftIndex);
      const snap = findSnapTarget(raw, verts, snapThreshold);
      return snap ? { x: snap.x, y: snap.y, snap } : { x: raw.x, y: raw.y, snap: null as SnapVertex | null };
    },
    [countries, draftPoints, snapThreshold],
  );

  const closeDraftPolygon = useCallback(() => {
    if (draftPoints.length < MIN_POLYGON_POINTS) {
      setDraftPoints([]);
      setCursorPoint(null);
      return;
    }
    const ring = normalizeClosedRing(draftPoints);
    addTerritoryRegion(ring);
    setDraftPoints([]);
    setCursorPoint(null);
    setSnapTarget(null);
  }, [draftPoints, addTerritoryRegion]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          setSpaceHeld(true);
        }
        return;
      }
      if (tool !== 'areaSelect' || !currentFrame) return;

      if (isEditableTarget(e.target)) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        closeDraftPolygon();
        return;
      }
      if (e.key === 'Escape') {
        setDraftPoints([]);
        setCursorPoint(null);
        setSnapTarget(null);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setDraftPoints((pts) => pts.slice(0, -1));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [tool, currentFrame, closeDraftPolygon]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const MIDDLE_BUTTON = 4;

    const endMiddlePan = () => {
      if (!middlePanRef.current.active) return;
      middlePanRef.current.active = false;
      setMiddlePanHeld(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      middlePanRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      setMiddlePanHeld(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!(e.buttons & MIDDLE_BUTTON)) {
        endMiddlePan();
        return;
      }
      if (!middlePanRef.current.active) return;
      const dx = e.clientX - middlePanRef.current.lastX;
      const dy = e.clientY - middlePanRef.current.lastY;
      middlePanRef.current.lastX = e.clientX;
      middlePanRef.current.lastY = e.clientY;
      const v = viewportRef.current;
      setViewport({ ...v, x: v.x + dx, y: v.y + dy });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 1) endMiddlePan();
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const blockMiddleAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove, true);
    el.addEventListener('pointerup', onPointerUp, true);
    el.addEventListener('pointercancel', onPointerUp, true);
    el.addEventListener('auxclick', blockMiddleAutoscroll, true);
    el.addEventListener('mousedown', blockMiddleAutoscroll, true);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', onPointerUp, true);
      el.removeEventListener('pointercancel', onPointerUp, true);
      el.removeEventListener('auxclick', blockMiddleAutoscroll, true);
      el.removeEventListener('mousedown', blockMiddleAutoscroll, true);
    };
  }, [setViewport, currentFrame?.entry.id]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy),
      );

      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldScale,
        y: (pointer.y - viewport.y) / oldScale,
      };

      setViewport({
        scale: newScale,
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [viewport, setViewport],
  );

  const handleStageMouseMove = () => {
    if (!isAreaSelect) {
      setCursorPoint(null);
      setSnapTarget(null);
      return;
    }
    const raw = getPointerOnImage();
    if (!raw) return;
    const { x, y, snap } = resolveSnap(raw);
    setCursorPoint({ x, y });
    setSnapTarget(snap);
  };

  const handlePlacementClick = useCallback(() => {
    const raw = getPointerOnImage();
    if (!raw) return;
    if (isCityTool) {
      setPendingCityPlacement({ x: raw.x, y: raw.y });
      return;
    }
    if (isDivisionTool) {
      void addDivisionMarker(raw.x, raw.y).then((id) => {
        if (id) setCropDivisionId(id);
      });
    }
  }, [getPointerOnImage, isCityTool, isDivisionTool, addDivisionMarker]);

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const raw = getPointerOnImage();
    if (!raw) return;

    if (isPlacementTool) return;

    if (!isAreaSelect || !activeColor) return;
    if (e.evt.altKey) {
      const draftHit = draftPoints.findIndex(
        (p) => Math.hypot(p.x - raw.x, p.y - raw.y) <= snapThreshold,
      );
      if (draftHit >= 0) {
        setDraftPoints((pts) => pts.filter((_, i) => i !== draftHit));
        return;
      }
    }

    const { x, y } = resolveSnap(raw);
    appendDraftPoint(x, y);
  };

  const handleStageDblClick = () => {
    if (!isAreaSelect) return;
    closeDraftPolygon();
  };

  const removeDraftAnchor = (index: number) => {
    setDraftPoints((pts) => pts.filter((_, i) => i !== index));
  };

  const appendDraftPoint = useCallback((x: number, y: number) => {
    setDraftPoints((pts) => {
      const last = pts[pts.length - 1];
      if (last && Math.hypot(last.x - x, last.y - y) < 0.5) return pts;
      return [...pts, { x, y }];
    });
  }, []);

  const handleAnchorPick = useCallback(
    (x: number, y: number) => {
      if (isAreaSelect) {
        appendDraftPoint(x, y);
        return;
      }
      if (selectedCountryId) void claimAnchor(x, y);
    },
    [isAreaSelect, appendDraftPoint, selectedCountryId, claimAnchor],
  );

  const handleSelectCountry = useCallback(
    (id: string) => {
      if (tool === 'areaSelect') return;
      setSelectedMarker(null, null);
      setSelectedCountry(id);
    },
    [tool, setSelectedMarker, setSelectedCountry],
  );

  const fitToView = useCallback(() => {
    if (!image || !containerRef.current) return;
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const scale = Math.min(
      (cw - padding) / image.width,
      (ch - padding) / image.height,
      1,
    );
    setViewport({
      scale,
      x: (cw - image.width * scale) / 2,
      y: (ch - image.height * scale) / 2,
    });
  }, [image, setViewport]);

  useEffect(() => {
    if (image) fitToView();
  }, [image, currentFrame?.entry.id, fitToView]);

  useEffect(() => {
    if (image && currentFrame && !currentFrame.isBlank && !currentFrame.isMissing) {
      setFileCanvasSize(currentFrame.filename, image.width, image.height);
    }
  }, [image, currentFrame, setFileCanvasSize]);

  const canvasWidth = image?.width ?? currentFrame?.canvasWidth ?? 1920;
  const canvasHeight = image?.height ?? currentFrame?.canvasHeight ?? 1080;
  const hasCanvas = Boolean(currentFrame);

  const fitBlankToView = useCallback(() => {
    if (!containerRef.current) return;
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const scale = Math.min(
      (cw - padding) / canvasWidth,
      (ch - padding) / canvasHeight,
      1,
    );
    setViewport({
      scale,
      x: (cw - canvasWidth * scale) / 2,
      y: (ch - canvasHeight * scale) / 2,
    });
  }, [canvasWidth, canvasHeight, setViewport]);

  useEffect(() => {
    if (currentFrame && !image) fitBlankToView();
  }, [currentFrame?.entry.id, image, fitBlankToView]);

  const cursor = middlePanHeld
    ? 'grabbing'
    : isKonvaPanDrag
      ? 'grab'
      : isAreaSelect
      ? snapTarget
        ? 'cell'
        : 'crosshair'
      : tool === 'select'
        ? 'pointer'
        : isCityTool || isDivisionTool
          ? 'crosshair'
          : 'default';

  return (
    <main className="panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="panel-header">
        <span className="led led-cyan" aria-hidden />
        <span className="panel-bracket">[</span>
        <Map className="h-3.5 w-3.5 text-accent-cyan" />
        <span className="panel-title">Viewport_Display</span>
        <span className="panel-bracket">]</span>
        {currentFrame && (
          <span className="ml-1 truncate font-mono text-[10px] tracking-wider text-text-muted uppercase">
            {displayFilename(currentFrame.filename)}
            {currentFrame.copyIndex > 0 || (state.assets[currentFrame.filename]?.length ?? 0) > 1
              ? ` · CPY_${currentFrame.copyIndex + 1}`
              : ''}
          </span>
        )}
        {hasCanvas && (
          <button
            type="button"
            className="btn-primary ml-auto"
            onClick={image ? fitToView : fitBlankToView}
          >
            Fit
          </button>
        )}
      </div>

      <div className="panel-inset flex min-h-0 flex-1 flex-col bg-surface">
      <div ref={containerRef} className="crt-bezel">
        {!currentFrame ? (
          <div className="relative z-[2] flex h-full flex-col items-center justify-center gap-3 font-mono text-xs tracking-widest text-text-muted uppercase">
            <Map className="h-14 w-14 opacity-25" />
            <p>:: Awaiting_Map_Feed ::</p>
          </div>
        ) : isMissing ? (
          <div className="relative z-[2] flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="h-14 w-14 text-accent-orange opacity-90" />
            <p className="font-mono text-sm font-bold tracking-widest text-accent-orange uppercase">
              Asset_Missing
            </p>
            <p className="font-mono text-[10px] tracking-wider text-accent-cyan uppercase">
              {displayFilename(currentFrame.filename)}
            </p>
            <p className="max-w-sm font-mono text-[10px] leading-relaxed tracking-wide text-text-muted uppercase">
              Reload folder or restore image to edit this frame.
            </p>
            <CanvasToolbar onEditDivisionCrop={(id) => setCropDivisionId(id)} />
          </div>
        ) : (
          <>
            <CanvasToolbar onEditDivisionCrop={(id) => setCropDivisionId(id)} />
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              draggable={isKonvaPanDrag}
              x={viewport.x}
              y={viewport.y}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              onWheel={handleWheel}
              onMouseMove={handleStageMouseMove}
              onClick={handleStageClick}
              onDblClick={handleStageDblClick}
              onDragEnd={(e) => {
                if (!isKonvaPanDrag) return;
                const v = viewportRef.current;
                setViewport({
                  ...v,
                  x: e.target.x(),
                  y: e.target.y(),
                });
              }}
              style={{ cursor }}
            >
              <Layer>
                {image ? (
                  <KonvaImage
                    image={image}
                    width={canvasWidth}
                    height={canvasHeight}
                    listening={false}
                  />
                ) : (
                  <>
                    <Rect
                      width={canvasWidth}
                      height={canvasHeight}
                      fill="#141418"
                      listening={false}
                    />
                    <Rect
                      width={canvasWidth}
                      height={canvasHeight}
                      stroke="#2a2a30"
                      strokeWidth={2}
                      dash={[12, 8]}
                      listening={false}
                    />
                  </>
                )}

                <TerritoryFillsLayer
                  countries={countries}
                  selectedCountryId={selectedCountryId}
                  outlineWidth={displaySettings.territoryBorderWidth}
                  onSelectCountry={handleSelectCountry}
                />
                {isPlacementTool && (
                  <Rect
                    width={canvasWidth}
                    height={canvasHeight}
                    fill="transparent"
                    listening
                    onClick={(e: Konva.KonvaEventObject<MouseEvent>) => {
                      if (e.evt.button !== 0) return;
                      e.cancelBubble = true;
                      handlePlacementClick();
                    }}
                  />
                )}
                <MarkerLayer
                  showCities={false}
                  showDivisions
                  divisions={divisions}
                  selectedMarkerId={selectedMarkerId}
                  selectedMarkerKind={selectedMarkerKind}
                  interactive={isMarkerInteractive}
                  onSelectMarker={(id, kind) => {
                    setSelectedCountry(null);
                    setSelectedMarker(id, kind);
                  }}
                  onMoveCity={(id, x, y) => void updateCityMarker(id, { x, y })}
                  onMoveDivision={(id, x, y) => void updateDivisionMarker(id, { x, y })}
                />
                <TerritoryLabelsLayer countries={countries} />
                <MarkerLayer
                  showDivisions={false}
                  showCities
                  cities={cities}
                  cityTextSize={displaySettings.cityTextSize}
                  cityMarkerStrokeWidth={displaySettings.cityMarkerStrokeWidth}
                  selectedMarkerId={selectedMarkerId}
                  selectedMarkerKind={selectedMarkerKind}
                  interactive={isMarkerInteractive}
                  onSelectMarker={(id, kind) => {
                    setSelectedCountry(null);
                    setSelectedMarker(id, kind);
                  }}
                  onMoveCity={(id, x, y) => void updateCityMarker(id, { x, y })}
                  onMoveDivision={(id, x, y) => void updateDivisionMarker(id, { x, y })}
                />
                <TerritoryLayer
                  countries={countries}
                  selectedCountryId={selectedCountryId}
                  activeFactionId={activeColorId}
                  viewportScale={viewport.scale}
                  showFills={false}
                  showLabels={false}
                  showAnchorHandles={showAnchorHandles}
                  outlineWidth={displaySettings.territoryBorderWidth}
                  draftPoints={draftPoints}
                  draftColor={draftColor}
                  cursorPoint={cursorPoint}
                  snapTarget={snapTarget}
                  onSelectCountry={handleSelectCountry}
                  onRemoveDraftAnchor={removeDraftAnchor}
                  onClaimAnchor={handleAnchorPick}
                  onRemoveTerritoryVertex={(countryId, ringIndex, vertexIndex) =>
                    void removeTerritoryVertex(countryId, ringIndex, vertexIndex)
                  }
                  onMoveTerritoryVertex={(countryId, ringIndex, vertexIndex, x, y) =>
                    void moveTerritoryVertex(countryId, ringIndex, vertexIndex, x, y)
                  }
                />
              </Layer>
            </Stage>
            <DisplaySettingsPanel />
          </>
        )}

        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#00e5ff 1px, transparent 1px), linear-gradient(90deg, #00e5ff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>
      </div>

      {pendingCityPlacement && (
        <CityNameModal
          onClose={() => setPendingCityPlacement(null)}
          onConfirm={(name) => {
            const { x, y } = pendingCityPlacement;
            setPendingCityPlacement(null);
            void addCityMarker(x, y, name);
          }}
        />
      )}

      {cropDivisionId && (
        <DivisionCropModal
          divisionId={cropDivisionId}
          onClose={() => setCropDivisionId(null)}
        />
      )}

      <PlaybackControls />
    </main>
  );
}
