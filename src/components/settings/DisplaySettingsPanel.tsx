import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import {
  clampDisplaySettings,
  DISPLAY_SETTINGS_LIMITS,
  type ProjectDisplaySettings,
} from '../../types/displaySettings';

function NumberRow({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <label className="flex flex-col gap-1 font-mono text-[9px] tracking-widest text-text-muted uppercase">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        className="w-full border border-border bg-surface px-2 py-1 font-mono text-xs text-text-primary tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function DisplaySettingsPanel() {
  const { state, updateDisplaySettings } = useProject();
  const settings = state.displaySettings;

  const commit = (patch: Partial<ProjectDisplaySettings>) => {
    updateDisplaySettings(clampDisplaySettings({ ...settings, ...patch }));
  };

  return (
    <section className="border border-border/60 bg-surface/50">
      <div className="border-b border-border/60 px-2 py-1.5 font-mono text-[9px] tracking-widest text-text-muted uppercase">
        Map display
      </div>
      <div className="flex flex-col gap-2 px-2 py-2">
        <NumberRow
          label="City text size"
          value={settings.cityTextSize}
          min={DISPLAY_SETTINGS_LIMITS.cityTextSize.min}
          max={DISPLAY_SETTINGS_LIMITS.cityTextSize.max}
          step={1}
          onCommit={(cityTextSize) => commit({ cityTextSize })}
        />
        <NumberRow
          label="Territory border"
          value={settings.territoryBorderWidth}
          min={DISPLAY_SETTINGS_LIMITS.territoryBorderWidth.min}
          max={DISPLAY_SETTINGS_LIMITS.territoryBorderWidth.max}
          step={0.5}
          onCommit={(territoryBorderWidth) => commit({ territoryBorderWidth })}
        />
        <NumberRow
          label="City marker border"
          value={settings.cityMarkerStrokeWidth}
          min={DISPLAY_SETTINGS_LIMITS.cityMarkerStrokeWidth.min}
          max={DISPLAY_SETTINGS_LIMITS.cityMarkerStrokeWidth.max}
          step={0.5}
          onCommit={(cityMarkerStrokeWidth) => commit({ cityMarkerStrokeWidth })}
        />
        <button
          type="button"
          className="btn-secondary flex items-center justify-center gap-1.5 py-1 font-mono text-[9px] tracking-wider uppercase"
          onClick={() => updateDisplaySettings(clampDisplaySettings({}))}
        >
          <RotateCcw className="h-3 w-3" />
          Reset defaults
        </button>
      </div>
    </section>
  );
}
