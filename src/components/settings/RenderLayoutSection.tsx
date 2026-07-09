import type { RenderLayoutOptions } from '../../types/renderOptions';
import { clampRenderLayout, DEFAULT_RENDER_LAYOUT, RENDER_LAYOUT_LIMITS } from '../../types/renderOptions';

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 font-mono text-[9px] tracking-widest text-text-muted uppercase">
      <span className="flex items-center justify-between gap-2">
        {label}
        <span className="text-accent-cyan normal-case tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full accent-accent-cyan"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

interface RenderLayoutSectionProps {
  layout: RenderLayoutOptions;
  showActiveDivisions: boolean;
  disabled?: boolean;
  onLayoutChange: (layout: RenderLayoutOptions) => void;
  onShowActiveDivisionsChange: (value: boolean) => void;
}

export function RenderLayoutSection({
  layout,
  showActiveDivisions,
  disabled,
  onLayoutChange,
  onShowActiveDivisionsChange,
}: RenderLayoutSectionProps) {
  const commit = (patch: Partial<RenderLayoutOptions>) => {
    onLayoutChange(clampRenderLayout({ ...layout, ...patch }));
  };

  return (
    <div className="space-y-2 border border-border/60 p-3">
      <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
        Layout &amp; sizing
      </p>
      <SliderRow
        label="Map size"
        value={layout.mapScale}
        min={RENDER_LAYOUT_LIMITS.mapScale.min}
        max={RENDER_LAYOUT_LIMITS.mapScale.max}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        disabled={disabled}
        onChange={(mapScale) => commit({ mapScale })}
      />
      <SliderRow
        label="Info board width"
        value={layout.dossierWidthFraction}
        min={RENDER_LAYOUT_LIMITS.dossierWidthFraction.min}
        max={RENDER_LAYOUT_LIMITS.dossierWidthFraction.max}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        disabled={disabled}
        onChange={(dossierWidthFraction) => commit({ dossierWidthFraction })}
      />
      <SliderRow
        label="Date/Era size"
        value={layout.dateFontScale}
        min={RENDER_LAYOUT_LIMITS.dateFontScale.min}
        max={RENDER_LAYOUT_LIMITS.dateFontScale.max}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        disabled={disabled}
        onChange={(dateFontScale) => commit({ dateFontScale })}
      />
      <SliderRow
        label="Event log size"
        value={layout.eventLogFontScale}
        min={RENDER_LAYOUT_LIMITS.eventLogFontScale.min}
        max={RENDER_LAYOUT_LIMITS.eventLogFontScale.max}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        disabled={disabled}
        onChange={(eventLogFontScale) => commit({ eventLogFontScale })}
      />
      <label className="flex cursor-pointer items-center justify-between gap-2 font-mono text-[10px] tracking-wide text-text-primary uppercase">
        Active divisions list
        <input
          type="checkbox"
          className="accent-accent-cyan"
          checked={showActiveDivisions}
          disabled={disabled}
          onChange={(e) => onShowActiveDivisionsChange(e.target.checked)}
        />
      </label>
      <button
        type="button"
        className="btn-secondary w-full py-1 font-mono text-[9px] tracking-wide uppercase"
        disabled={disabled}
        onClick={() => onLayoutChange({ ...DEFAULT_RENDER_LAYOUT })}
      >
        Reset layout defaults
      </button>
    </div>
  );
}
