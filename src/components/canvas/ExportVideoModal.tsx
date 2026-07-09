import { Film, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DIVISION_MOTION_FPS,
  DEFAULT_SECONDS_PER_FRAME,
} from '../../constants/playback';
import { useProject } from '../../context/ProjectContext';
import { RenderLayoutSection } from '../settings/RenderLayoutSection';
import { RenderPreviewPanel } from './RenderPreviewPanel';
import type { FrameRenderOptions, RenderLayoutOptions } from '../../types/renderOptions';
import { videoExportRenderOptions } from '../../types/renderOptions';

interface ExportVideoModalProps {
  frameCount: number;
  isExporting: boolean;
  exportComplete: boolean;
  progress: number;
  captureLabel?: string | null;
  error: string | null;
  saveMessage: string | null;
  onConfirm: (options: FrameRenderOptions, secondsPerFrame: number, divisionMotionFps: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 font-mono text-[10px] tracking-wide text-text-primary uppercase">
      {label}
      <input
        type="checkbox"
        className="accent-accent-cyan"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function ExportVideoModal({
  frameCount,
  isExporting,
  exportComplete,
  progress,
  captureLabel,
  error,
  saveMessage,
  onConfirm,
  onSave,
  onCancel,
  onClose,
}: ExportVideoModalProps) {
  const { state } = useProject();
  const defaults = useMemo(
    () => videoExportRenderOptions(state.displaySettings),
    [state.displaySettings],
  );

  const [secondsPerFrame, setSecondsPerFrame] = useState(DEFAULT_SECONDS_PER_FRAME);
  const [divisionMotionFps, setDivisionMotionFps] = useState(DEFAULT_DIVISION_MOTION_FPS);
  const [showBackground, setShowBackground] = useState(defaults.showBackground);
  const [showLabels, setShowLabels] = useState(defaults.showLabels);
  const [territoryDisplayMode, setTerritoryDisplayMode] = useState(
    defaults.territoryDisplayMode,
  );
  const [showCities, setShowCities] = useState(defaults.showCities);
  const [showDivisions, setShowDivisions] = useState(defaults.showDivisions);
  const [showDossier, setShowDossier] = useState(defaults.showDossier);
  const [showActiveDivisions, setShowActiveDivisions] = useState(defaults.showActiveDivisions);
  const [layout, setLayout] = useState<RenderLayoutOptions>(defaults.layout);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExporting, onClose]);

  const buildOptions = useMemo(
    (): FrameRenderOptions => ({
      showBackground,
      showLabels,
      territoryDisplayMode,
      showCities,
      showDivisions,
      showDossier,
      showActiveDivisions,
      layout,
      visibleCountryIds: null,
    }),
    [
      showBackground,
      showLabels,
      territoryDisplayMode,
      showCities,
      showDivisions,
      showDossier,
      showActiveDivisions,
      layout,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (!isExporting && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel flex max-h-[90vh] w-full max-w-5xl flex-col">
        <div className="panel-header shrink-0">
          <Film className="h-3.5 w-3.5 text-accent-orange" />
          <span className="panel-title">[[ Compile_Video ]]</span>
          {!isExporting && (
            <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
          {!isExporting && (
            <div className="h-[280px] shrink-0 lg:h-auto lg:w-[min(440px,42%)]">
              <RenderPreviewPanel renderOptions={buildOptions} />
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
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
              one hold frame. Glide requires the same division name on both frames (set in crop
              editor)—copy/paste or reuse the name when placing on the next frame.
            </p>
          </label>

          <div className="space-y-2 border border-border/60 p-3">
            <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">Layers</p>
            <ToggleRow
              label="Background"
              checked={showBackground}
              disabled={isExporting}
              onChange={setShowBackground}
            />
            <ToggleRow
              label="Settlements"
              checked={showCities}
              disabled={isExporting}
              onChange={setShowCities}
            />
            <ToggleRow
              label="Divisions"
              checked={showDivisions}
              disabled={isExporting}
              onChange={setShowDivisions}
            />
            <ToggleRow
              label="Dossier panel"
              checked={showDossier}
              disabled={isExporting}
              onChange={setShowDossier}
            />
          </div>

          <RenderLayoutSection
            layout={layout}
            showActiveDivisions={showActiveDivisions}
            disabled={isExporting}
            onLayoutChange={setLayout}
            onShowActiveDivisionsChange={setShowActiveDivisions}
          />

          <div className="space-y-2 border border-border/60 p-3">
            <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Territory display
            </p>
            <label className="flex flex-col gap-1 font-mono text-[9px] tracking-widest text-text-muted uppercase">
              Mode
              <select
                className="w-full border border-border bg-surface px-2 py-1 font-mono text-xs text-text-primary normal-case"
                value={territoryDisplayMode}
                disabled={isExporting}
                onChange={(e) =>
                  setTerritoryDisplayMode(e.target.value === 'flag' ? 'flag' : 'color')
                }
              >
                <option value="color">Color + labels</option>
                <option value="flag">Flag fill</option>
              </select>
            </label>
            <ToggleRow
              label="Nation labels"
              checked={showLabels}
              disabled={isExporting || territoryDisplayMode === 'flag'}
              onChange={setShowLabels}
            />
          </div>

          {isExporting && (
            <div>
              <div className="mb-1 h-2 border border-metal-shadow bg-surface">
                <div
                  className="h-full bg-accent-orange transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="font-mono text-[9px] text-accent-cyan">
                {captureLabel ?? `${progress}%`}
              </p>
            </div>
          )}

          {error && (
            <p className="font-mono text-[9px] text-accent-orange uppercase">{error}</p>
          )}

          {exportComplete && !error && (
            <div className="rounded border border-accent-cyan/40 bg-accent-cyan/5 p-2">
              <p className="font-mono text-[9px] text-accent-cyan uppercase">
                Video ready
              </p>
              {saveMessage && (
                <p className="mt-1 font-mono text-[8px] leading-snug text-text-muted">
                  {saveMessage}
                </p>
              )}
              <p className="mt-1 font-mono text-[8px] leading-snug text-text-muted">
                If nothing appeared in Downloads, click Save MP4 to choose where to save it.
              </p>
            </div>
          )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-metal-shadow px-4 py-3">
          {isExporting ? (
            <button type="button" className="btn-ghost" onClick={onCancel}>
              Abort
            </button>
          ) : exportComplete ? (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn-primary" onClick={onSave}>
                Save MP4
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={frameCount === 0}
                onClick={() => onConfirm(buildOptions, secondsPerFrame, divisionMotionFps)}
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
