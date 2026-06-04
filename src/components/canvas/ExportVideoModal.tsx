import { Film, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_DIVISION_MOTION_FPS,
  DEFAULT_SECONDS_PER_FRAME,
} from '../../constants/playback';

interface ExportVideoModalProps {
  frameCount: number;
  isExporting: boolean;
  progress: number;
  error: string | null;
  onConfirm: (secondsPerFrame: number, divisionMotionFps: number) => void;
  onCancel: () => void;
  onClose: () => void;
}

export function ExportVideoModal({
  frameCount,
  isExporting,
  progress,
  error,
  onConfirm,
  onCancel,
  onClose,
}: ExportVideoModalProps) {
  const [secondsPerFrame, setSecondsPerFrame] = useState(DEFAULT_SECONDS_PER_FRAME);
  const [divisionMotionFps, setDivisionMotionFps] = useState(DEFAULT_DIVISION_MOTION_FPS);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExporting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (!isExporting && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-md">
        <div className="panel-header">
          <Film className="h-3.5 w-3.5 text-accent-orange" />
          <span className="panel-title">[[ Compile_Video ]]</span>
          {!isExporting && (
            <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          <p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">
            Frames: {frameCount} · Server ffmpeg encode
          </p>

          <label className="block">
            <span className="mb-1 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Seconds per frame
            </span>
            <input
              type="number"
              min={0.25}
              max={30}
              step={0.25}
              disabled={isExporting}
              className="input-field"
              value={secondsPerFrame}
              onChange={(e) => setSecondsPerFrame(Number(e.target.value))}
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Division motion FPS
            </span>
            <input
              type="number"
              min={1}
              max={120}
              step={1}
              disabled={isExporting}
              className="input-field"
              value={divisionMotionFps}
              onChange={(e) => setDivisionMotionFps(Number(e.target.value))}
            />
            <p className="mt-1 font-mono text-[8px] leading-relaxed text-text-muted">
              Subframes per second between timeline frames when a division moves; static gaps use
              one hold frame.
            </p>
          </label>

          {isExporting && (
            <div>
              <div className="mb-1 h-2 border border-metal-shadow bg-surface">
                <div
                  className="h-full bg-accent-orange transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="font-mono text-[9px] text-accent-cyan">{progress}%</p>
            </div>
          )}

          {error && (
            <p className="font-mono text-[9px] text-accent-orange uppercase">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-metal-shadow px-4 py-3">
          {isExporting ? (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Abort
            </button>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={frameCount === 0}
                onClick={() => onConfirm(secondsPerFrame, divisionMotionFps)}
              >
                Compile
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
