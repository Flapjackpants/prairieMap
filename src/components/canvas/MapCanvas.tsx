import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import type Konva from 'konva';
import { AlertTriangle, Map } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { normalizeClosedRing } from '../../utils/territoryGeometry';
import { SNAP_THRESHOLD_PX } from '../../types/project';
import { collectSnapVertices, findSnapTarget, type SnapVertex } from '../../utils/vertexSnap';
import { CanvasToolbar } from './CanvasToolbar';
import { PlaybackControls } from './PlaybackControls';
import { TerritoryLayer } from './TerritoryLayer';

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
    setSelectedCountry,
    setFileCanvasSize,
    setTool,
  } = useProject();

  const { tool, viewport, selectedCountryId } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([]);
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapTarget, setSnapTarget] = useState<SnapVertex | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const image = useLoadedImage(
    currentFrame && !currentFrame.isMissing ? currentFrame.objectUrl : null,
  );
  const countries = currentFrame?.frameData.annotations.countries ?? [];
  const isMissing = currentFrame?.isMissing ?? false;

  const isPanMode = tool === 'pan' || spaceHeld;
  const isAreaSelect = tool === 'areaSelect' && !isPanMode;
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
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (tool !== 'areaSelect' || !currentFrame) return;

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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isAreaSelect || !activeColor) return;

    const raw = getPointerOnImage();
    if (!raw) return;

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
    setDraftPoints((pts) => [...pts, { x, y }]);
  };

  const handleStageDblClick = () => {
    if (!isAreaSelect) return;
    closeDraftPolygon();
  };

  const removeDraftAnchor = (index: number) => {
    setDraftPoints((pts) => pts.filter((_, i) => i !== index));
  };

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

  const cursor = isPanMode
    ? 'grab'
    : isAreaSelect
      ? snapTarget
        ? 'cell'
        : 'crosshair'
      : tool === 'select'
        ? 'pointer'
        : 'default';

  return (
    <main className="panel flex min-w-0 flex-col border-x-0">
      <div className="panel-header">
        <Map className="h-4 w-4 text-accent-cyan" />
        <span className="text-sm font-semibold tracking-wide uppercase">Map Canvas</span>
        {currentFrame && (
          <span className="ml-2 truncate font-mono text-xs text-text-muted">
            {displayFilename(currentFrame.filename)}
            {currentFrame.copyIndex > 0 || (state.assets[currentFrame.filename]?.length ?? 0) > 1
              ? ` · copy ${currentFrame.copyIndex + 1}`
              : ''}
          </span>
        )}
        {hasCanvas && (
          <button
            type="button"
            className="btn-primary ml-auto text-xs"
            onClick={image ? fitToView : fitBlankToView}
          >
            Fit View
          </button>
        )}
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#0a0a0c]">
        {!currentFrame ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
            <Map className="h-16 w-16 opacity-30" />
            <p className="text-sm">Load a folder to display the map canvas</p>
          </div>
        ) : isMissing ? (
          <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="h-16 w-16 text-accent-crimson opacity-80" />
            <p className="text-lg font-semibold text-accent-crimson">Missing Asset</p>
            <p className="font-mono text-sm text-text-muted">
              {displayFilename(currentFrame.filename)}
            </p>
            <p className="max-w-sm text-sm text-text-muted">
              This file is not in the loaded folder. Reload the folder or restore the image to
              edit this frame.
            </p>
            <CanvasToolbar />
          </div>
        ) : (
          <>
            <CanvasToolbar />
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              draggable={isPanMode}
              x={viewport.x}
              y={viewport.y}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              onWheel={handleWheel}
              onMouseMove={handleStageMouseMove}
              onClick={handleStageClick}
              onDblClick={handleStageDblClick}
              onDragEnd={(e) => {
                if (isPanMode) {
                  setViewport({
                    ...viewport,
                    x: e.target.x(),
                    y: e.target.y(),
                  });
                }
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

                <TerritoryLayer
                  countries={countries}
                  selectedCountryId={selectedCountryId}
                  draftPoints={draftPoints}
                  draftColor={activeColor?.hex ?? '#00e5ff'}
                  cursorPoint={cursorPoint}
                  snapTarget={snapTarget}
                  onSelectCountry={(id) => {
                    setSelectedCountry(id);
                    setTool('select');
                  }}
                  onRemoveDraftAnchor={removeDraftAnchor}
                />
              </Layer>
            </Stage>
          </>
        )}

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#00e5ff 1px, transparent 1px), linear-gradient(90deg, #00e5ff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <PlaybackControls />
    </main>
  );
}
