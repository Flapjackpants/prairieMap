import { CalendarClock, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  computeTimelineDateTitles,
  fromDatetimeLocalValue,
  parseTimelineDateTitle,
  toDatetimeLocalValue,
} from '../../utils/timelineDates';

export interface AutoDateModalConfig {
  startAt: Date;
  framesPerStep: number;
  minutesPerStep: number;
}

interface AutoDateModalProps {
  frameCount: number;
  initialDateTitle?: string;
  onConfirm: (config: AutoDateModalConfig) => void;
  onClose: () => void;
}

export function AutoDateModal({
  frameCount,
  initialDateTitle,
  onConfirm,
  onClose,
}: AutoDateModalProps) {
  const defaultStart = useMemo(() => {
    const parsed = initialDateTitle ? parseTimelineDateTitle(initialDateTitle) : null;
    return parsed ?? new Date();
  }, [initialDateTitle]);

  const [startValue, setStartValue] = useState(() => toDatetimeLocalValue(defaultStart));
  const [framesPerStep, setFramesPerStep] = useState(6);
  const [minutesPerStep, setMinutesPerStep] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startAt = fromDatetimeLocalValue(startValue);
  const preview = useMemo(() => {
    if (!startAt || frameCount === 0) return [];
    return computeTimelineDateTitles(frameCount, {
      startAt,
      framesPerStep,
      minutesPerStep,
    });
  }, [startAt, frameCount, framesPerStep, minutesPerStep]);

  const handleApply = () => {
    if (!startAt) return;
    if (framesPerStep < 1 || minutesPerStep < 0) return;
    onConfirm({ startAt, framesPerStep, minutesPerStep });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-md shadow-2xl">
        <div className="panel-header">
          <CalendarClock className="h-3.5 w-3.5 text-accent-cyan" />
          <span className="panel-title">Auto-fill timeline dates</span>
          <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="panel-inset flex flex-col gap-3 p-3">
          <p className="font-mono text-[9px] leading-snug text-text-muted">
            Sets each frame&apos;s Date_Era on the info board. Every N frames, the timestamp
            advances by the chosen amount (e.g. 6 frames → +1 minute).
          </p>
          <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Start date &amp; time
            <input
              type="datetime-local"
              className="input-field mt-1 w-full font-mono text-xs normal-case"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Frames per step
              <input
                type="number"
                min={1}
                className="input-field mt-1 w-full font-mono text-xs"
                value={framesPerStep}
                onChange={(e) => setFramesPerStep(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Minutes per step
              <input
                type="number"
                min={0}
                step={1}
                className="input-field mt-1 w-full font-mono text-xs"
                value={minutesPerStep}
                onChange={(e) => setMinutesPerStep(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </div>
          {preview.length > 0 && (
            <div className="rounded border border-border bg-surface/80 p-2">
              <p className="mb-1 font-mono text-[8px] tracking-widest text-accent-cyan uppercase">
                Preview
              </p>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono text-[9px] text-text-primary">
                {preview.slice(0, 8).map((title, index) => (
                  <li key={index}>
                    Frame {String(index + 1).padStart(2, '0')}: {title}
                  </li>
                ))}
                {preview.length > 8 && (
                  <li className="text-text-muted">… {preview.length - 8} more frames</li>
                )}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!startAt || frameCount === 0}
              onClick={handleApply}
            >
              Apply to {frameCount} frame{frameCount === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
