import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Map } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { CanvasToolbar } from './CanvasToolbar';
import { PlaybackControls } from './PlaybackControls';
import type { MapLabel, DrawStroke } from '../../types/project';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

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
    addStroke,
    updateLabel,
    deleteLabel,
    setFileCanvasSize,
  } = useProject();

  const { tool, brushSize, brushOpacity, viewport } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawStroke | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const image = useLoadedImage(
    currentFrame && !currentFrame.isMissing ? currentFrame.objectUrl : null,
  );
  const annotations = currentFrame?.frameData.annotations ?? { strokes: [], labels: [] };
  const isMissing = currentFrame?.isMissing ?? false;

  const isPanMode = tool === 'pan' || spaceHeld;

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !editingLabelId) {
        e.preventDefault();
        setSpaceHeld(true);
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
  }, [editingLabelId]);

  const getPointerOnImage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }, []);

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

  const handleStageMouseDown = () => {
    const point = getPointerOnImage();
    if (!point || !activeColor) return;

    if (tool === 'text') {
      const label: MapLabel = {
        id: uuidv4(),
        x: point.x,
        y: point.y,
        text: 'Label',
        fontSize: 18,
        color: activeColor.hex,
      };
      updateLabel(label);
      setSelectedLabelId(label.id);
      setEditingLabelId(label.id);
      setEditText(label.text);
      return;
    }

    if (tool === 'brush' && !isPanMode) {
      setIsDrawing(true);
      const stroke: DrawStroke = {
        id: uuidv4(),
        points: [{ x: point.x, y: point.y }],
        color: activeColor.hex,
        size: brushSize,
        opacity: brushOpacity,
      };
      setCurrentStroke(stroke);
    }
  };

  const handleStageMouseMove = () => {
    if (!isDrawing || !currentStroke || tool !== 'brush') return;
    const point = getPointerOnImage();
    if (!point) return;
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, { x: point.x, y: point.y }],
    });
  };

  const handleStageMouseUp = () => {
    if (isDrawing && currentStroke) {
      addStroke(currentStroke);
      setCurrentStroke(null);
    }
    setIsDrawing(false);
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
      if (!currentFrame.isBlank) {
        setFileCanvasSize(currentFrame.filename, image.width, image.height);
      }
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
              onMouseDown={handleStageMouseDown}
              onMousemove={handleStageMouseMove}
              onMouseup={handleStageMouseUp}
              onMouseleave={handleStageMouseUp}
              onDragEnd={(e) => {
                if (isPanMode) {
                  setViewport({
                    ...viewport,
                    x: e.target.x(),
                    y: e.target.y(),
                  });
                }
              }}
              style={{ cursor: isPanMode ? 'grab' : tool === 'brush' ? 'crosshair' : 'default' }}
            >
              <Layer>
                {image ? (
                  <KonvaImage image={image} width={canvasWidth} height={canvasHeight} listening={false} />
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

                {annotations.strokes.map((stroke) => (
                  <Line
                    key={stroke.id}
                    points={stroke.points.flatMap((p) => [p.x, p.y])}
                    stroke={stroke.color}
                    strokeWidth={stroke.size}
                    opacity={stroke.opacity}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.3}
                    globalCompositeOperation="source-over"
                  />
                ))}

                {currentStroke && (
                  <Line
                    points={currentStroke.points.flatMap((p) => [p.x, p.y])}
                    stroke={currentStroke.color}
                    strokeWidth={currentStroke.size}
                    opacity={currentStroke.opacity}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.3}
                  />
                )}

                {annotations.labels.map((label) => (
                  <Group
                    key={label.id}
                    x={label.x}
                    y={label.y}
                    draggable={tool === 'select' || tool === 'text'}
                    onClick={() => setSelectedLabelId(label.id)}
                    onDblClick={() => {
                      setEditingLabelId(label.id);
                      setEditText(label.text);
                    }}
                    onDragEnd={(e) => {
                      updateLabel({
                        ...label,
                        x: e.target.x(),
                        y: e.target.y(),
                      });
                    }}
                  >
                    <Rect
                      width={(label.text.length + 2) * (label.fontSize * 0.55)}
                      height={label.fontSize + 8}
                      fill="rgba(18,18,20,0.75)"
                      stroke={selectedLabelId === label.id ? '#00e5ff' : label.color}
                      strokeWidth={selectedLabelId === label.id ? 2 : 1}
                      cornerRadius={2}
                    />
                    <Text
                      text={label.text}
                      fontSize={label.fontSize}
                      fill={label.color}
                      fontFamily="Rajdhani, sans-serif"
                      fontStyle="bold"
                      padding={4}
                    />
                  </Group>
                ))}
              </Layer>
            </Stage>

            {editingLabelId && (
              <LabelEditor
                label={annotations.labels.find((l) => l.id === editingLabelId)!}
                editText={editText}
                viewport={viewport}
                onChange={setEditText}
                onSave={() => {
                  const label = annotations.labels.find((l) => l.id === editingLabelId);
                  if (label) updateLabel({ ...label, text: editText });
                  setEditingLabelId(null);
                }}
                onCancel={() => setEditingLabelId(null)}
                onDelete={() => {
                  deleteLabel(editingLabelId);
                  setEditingLabelId(null);
                  setSelectedLabelId(null);
                }}
              />
            )}
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

function LabelEditor({
  label,
  editText,
  viewport,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  label: MapLabel;
  editText: string;
  viewport: { scale: number; x: number; y: number };
  onChange: (t: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const screenX = label.x * viewport.scale + viewport.x;
  const screenY = label.y * viewport.scale + viewport.y;

  return (
    <div
      className="absolute z-30 flex flex-col gap-1 rounded border border-accent-cyan/50 bg-surface-raised p-2 shadow-lg"
      style={{ left: screenX, top: screenY }}
    >
      <input
        className="input-field min-w-[160px]"
        value={editText}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
      />
      <div className="flex gap-1">
        <button type="button" className="btn-primary flex-1 text-xs" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn-icon text-xs text-accent-crimson" onClick={onDelete}>
          Del
        </button>
      </div>
    </div>
  );
}
