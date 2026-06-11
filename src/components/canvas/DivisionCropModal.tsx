import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapImageUrl } from '../../hooks/useMapImageUrl';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { DEFAULT_DIVISION_MARKER_SIZE, isBlankAssetKey } from '../../types/project';
import type { DivisionCropRect } from '../../types/project';

interface DivisionCropModalProps {
  divisionId: string;
  onClose: () => void;
}

export function DivisionCropModal({ divisionId, onClose }: DivisionCropModalProps) {
  const { state, currentFrame, updateDivisionMarker } = useProject();
  const division = currentFrame?.frameData.annotations.divisions.find((d) => d.id === divisionId);
  const filenames = Object.keys(state.assets).filter((f) => !isBlankAssetKey(f));

  const [sourceFilename, setSourceFilename] = useState(division?.sourceFilename ?? filenames[0] ?? '');
  const [crop, setCrop] = useState<DivisionCropRect>(
    division?.crop ?? { x: 0, y: 0, width: 64, height: 64 },
  );
  const [size, setSize] = useState(division?.size ?? DEFAULT_DIVISION_MARKER_SIZE);
  const [name, setName] = useState(division?.name?.trim() || 'Division');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startCrop: DivisionCropRect } | null>(null);

  useEffect(() => {
    if (division) {
      setName(division.name?.trim() || 'Division');
      setSourceFilename(division.sourceFilename);
      setCrop(division.crop);
      setSize(division.size);
    }
  }, [divisionId, division]);

  const sourceFile = sourceFilename
    ? state.fileRegistry[sourceFilename]?.file ?? null
    : null;
  const sourceUrl = useMapImageUrl(
    sourceFilename || null,
    sourceFile,
    Boolean(sourceFilename && sourceFile && !isBlankAssetKey(sourceFilename)),
  );

  useEffect(() => {
    if (!sourceUrl) {
      setImg(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = sourceUrl;
  }, [sourceUrl]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const maxW = 480;
    const maxH = 320;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const sx = crop.x * scale;
    const sy = crop.y * scale;
    const sw = crop.width * scale;
    const sh = crop.height * scale;
    ctx.fillStyle = 'rgba(0,229,255,0.15)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
    const handle = 8;
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(sx + sw - handle, sy + sh - handle, handle, handle);
    ctx.strokeStyle = '#0a0a0c';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + sw - handle, sy + sh - handle, handle, handle);
  }, [img, crop]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const canvasToImage = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const displayScale = canvas.width / img.width;
    const x = ((clientX - rect.left) / rect.width) * canvas.width / displayScale;
    const y = ((clientY - rect.top) / rect.height) * canvas.height / displayScale;
    return { x: Math.max(0, x), y: Math.max(0, y) };
  };

  const pointerToCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const hitResizeHandle = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return false;
    const { x: canvasX, y: canvasY } = pointerToCanvas(clientX, clientY);
    const displayScale = canvas.width / img.width;
    const brX = (crop.x + crop.width) * displayScale;
    const brY = (crop.y + crop.height) * displayScale;
    return Math.hypot(canvasX - brX, canvasY - brY) < 14;
  };

  const updateCanvasCursor = (clientX: number, clientY: number, dragging: 'move' | 'resize' | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (dragging === 'resize') {
      canvas.style.cursor = 'nwse-resize';
    } else if (dragging === 'move') {
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = hitResizeHandle(clientX, clientY) ? 'nwse-resize' : 'crosshair';
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const pt = canvasToImage(e.clientX, e.clientY);
    const nearBr = hitResizeHandle(e.clientX, e.clientY);
    const mode = nearBr ? 'resize' : 'move';
    dragRef.current = {
      mode,
      startX: pt.x,
      startY: pt.y,
      startCrop: { ...crop },
    };
    updateCanvasCursor(e.clientX, e.clientY, mode);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!img) return;
    if (!dragRef.current) {
      updateCanvasCursor(e.clientX, e.clientY, null);
      return;
    }
    const pt = canvasToImage(e.clientX, e.clientY);
    const dx = pt.x - dragRef.current.startX;
    const dy = pt.y - dragRef.current.startY;
    const start = dragRef.current.startCrop;
    if (dragRef.current.mode === 'move') {
      setCrop({
        ...start,
        x: Math.max(0, Math.min(img.width - start.width, start.x + dx)),
        y: Math.max(0, Math.min(img.height - start.height, start.y + dy)),
      });
    } else {
      const w = Math.max(8, Math.min(img.width - start.x, start.width + dx));
      const h = Math.max(8, Math.min(img.height - start.y, start.height + dy));
      setCrop({ ...start, width: w, height: h });
    }
    updateCanvasCursor(e.clientX, e.clientY, dragRef.current.mode);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    updateCanvasCursor(e.clientX, e.clientY, null);
  };

  const handleSave = () => {
    if (!division) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    void updateDivisionMarker(divisionId, {
      name: trimmed,
      sourceFilename,
      crop,
      size,
    }).then(onClose);
  };

  if (!division) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-lg shadow-2xl">
        <div className="panel-header">
          <span className="panel-title">Division icon crop</span>
        </div>
        <div className="panel-inset flex flex-col gap-3 p-3">
          <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Division name
            <input
              type="text"
              className="mt-1 w-full border border-border bg-surface px-2 py-1 font-mono text-xs text-text-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Same name on each frame for video glide"
            />
          </label>
          <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Source image
            <select
              className="mt-1 w-full border border-border bg-surface px-2 py-1 font-mono text-xs text-text-primary"
              value={sourceFilename}
              onChange={(e) => setSourceFilename(e.target.value)}
            >
              {filenames.map((f) => (
                <option key={f} value={f}>
                  {displayFilename(f)}
                </option>
              ))}
            </select>
          </label>
          <div className="overflow-hidden rounded border border-border bg-[#0a0a0c]">
            <canvas
              ref={canvasRef}
              className="max-h-[320px] w-full cursor-crosshair touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
          <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Marker size (px)
            <input
              type="number"
              min={16}
              max={256}
              className="mt-1 w-full border border-border bg-surface px-2 py-1 font-mono text-xs"
              value={size}
              onChange={(e) => setSize(Number(e.target.value) || 48)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
