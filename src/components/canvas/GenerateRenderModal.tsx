import { Camera, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { RenderLayoutSection } from '../settings/RenderLayoutSection';
import { RenderPreviewPanel } from './RenderPreviewPanel';
import type { FrameRenderOptions, RenderLayoutOptions } from '../../types/renderOptions';
import { defaultFrameRenderOptions } from '../../types/renderOptions';

interface GenerateRenderModalProps {
  isRendering: boolean;
  error: string | null;
  onRender: (options: FrameRenderOptions) => void;
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

export function GenerateRenderModal({
  isRendering,
  error,
  onRender,
  onClose,
}: GenerateRenderModalProps) {
  const { state, currentFrame } = useProject();
  const countries = currentFrame?.frameData.annotations.countries ?? [];
  const hasDossierContent = Boolean(
    currentFrame?.frameData.info.dateTitle.trim() ||
      currentFrame?.frameData.info.description.trim(),
  );
  const defaults = useMemo(
    () => defaultFrameRenderOptions(state.displaySettings, hasDossierContent),
    [state.displaySettings, hasDossierContent],
  );

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
  const [visibleCountryIds, setVisibleCountryIds] = useState<Set<string>>(
    () => new Set(countries.map((c) => c.id)),
  );

  const countryIdsKey = countries.map((c) => c.id).join(',');

  useEffect(() => {
    setVisibleCountryIds(new Set(countryIdsKey ? countryIdsKey.split(',') : []));
  }, [currentFrame?.entry.id, countryIdsKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRendering) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRendering, onClose]);

  const toggleCountry = (id: string) => {
    setVisibleCountryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRender = () => {
    onRender(previewOptions);
  };

  const previewOptions = useMemo(
    (): FrameRenderOptions => ({
      showBackground,
      showLabels,
      territoryDisplayMode,
      showCities,
      showDivisions,
      showDossier,
      showActiveDivisions,
      layout,
      visibleCountryIds:
        visibleCountryIds.size === countries.length ? null : [...visibleCountryIds],
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
      visibleCountryIds,
      countries.length,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isRendering) onClose();
      }}
    >
      <div className="panel flex max-h-[90vh] w-full max-w-5xl flex-col">
        <div className="panel-header shrink-0">
          <Camera className="h-3.5 w-3.5 text-accent-cyan" />
          <span className="panel-title">[[ Generate_Render ]]</span>
          <button
            type="button"
            className="btn-icon ml-auto h-7 w-7"
            disabled={isRendering}
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
          <div className="h-[280px] shrink-0 lg:h-auto lg:w-[min(440px,42%)]">
            <RenderPreviewPanel renderOptions={previewOptions} disabled={isRendering} />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2 border border-border/60 p-3">
            <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">Layers</p>
            <ToggleRow label="Background" checked={showBackground} onChange={setShowBackground} />
            {!showBackground && (
              <p className="font-mono text-[8px] leading-snug tracking-wide text-text-muted uppercase">
                Map area exports with a transparent background.
              </p>
            )}
            <ToggleRow label="Settlements" checked={showCities} onChange={setShowCities} />
            <ToggleRow label="Divisions" checked={showDivisions} onChange={setShowDivisions} />
            <ToggleRow label="Dossier panel" checked={showDossier} onChange={setShowDossier} />
            <p className="font-mono text-[8px] leading-snug tracking-wide text-text-muted">
              Date/Era, Event Log, and Active Divisions appear in the right-side panel when enabled.
            </p>
          </div>

          <RenderLayoutSection
            layout={layout}
            showActiveDivisions={showActiveDivisions}
            disabled={isRendering}
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
              disabled={territoryDisplayMode === 'flag'}
              onChange={setShowLabels}
            />
          </div>

          {countries.length > 0 && (
            <div className="space-y-2 border border-border/60 p-3">
              <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
                Nations on frame
              </p>
              {countries.map((country) => (
                <label
                  key={country.id}
                  className="flex cursor-pointer items-center gap-2 font-mono text-[10px] text-text-primary uppercase"
                >
                  <input
                    type="checkbox"
                    className="accent-accent-cyan"
                    checked={visibleCountryIds.has(country.id)}
                    onChange={() => toggleCountry(country.id)}
                  />
                  <span
                    className="h-3 w-3 shrink-0 border border-metal-shadow"
                    style={{ backgroundColor: country.color }}
                  />
                  {country.name}
                </label>
              ))}
            </div>
          )}

          {error && (
            <p className="font-mono text-xs text-accent-crimson">{error}</p>
          )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border p-4">
          <button type="button" className="btn-secondary" disabled={isRendering} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1"
            disabled={isRendering}
            onClick={handleRender}
          >
            <Camera className="h-3 w-3" />
            {isRendering ? 'Rendering…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
