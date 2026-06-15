import { RotateCcw, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useLocalDisplaySettings } from '../../context/LocalDisplaySettingsContext';
import { LOCAL_DISPLAY_LIMITS } from '../../types/localDisplaySettings';

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 font-mono text-[9px] tracking-widest text-text-muted uppercase">
      <span className="flex items-center justify-between">
        {label}
        <span className="tabular-nums text-accent-cyan">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-cyan"
      />
    </label>
  );
}

export function DisplaySettingsPanel() {
  const { settings, updateSettings, resetSettings } = useLocalDisplaySettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-3 bottom-3 z-20 flex flex-col items-end gap-1">
      {open && (
        <div className="panel w-56 shadow-xl">
          <div className="panel-header">
            <Settings2 className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="panel-title">Display</span>
          </div>
          <div className="panel-inset flex flex-col gap-3 p-3">
            <p className="font-mono text-[8px] leading-snug tracking-wide text-text-muted uppercase">
              Display prefs (not saved to project)
            </p>
            <SliderRow
              label="City text size"
              value={settings.cityTextSize}
              min={LOCAL_DISPLAY_LIMITS.cityTextSize.min}
              max={LOCAL_DISPLAY_LIMITS.cityTextSize.max}
              step={1}
              onChange={(cityTextSize) => updateSettings({ cityTextSize })}
            />
            <SliderRow
              label="Territory border"
              value={settings.territoryBorderWidth}
              min={LOCAL_DISPLAY_LIMITS.territoryBorderWidth.min}
              max={LOCAL_DISPLAY_LIMITS.territoryBorderWidth.max}
              step={0.5}
              onChange={(territoryBorderWidth) => updateSettings({ territoryBorderWidth })}
            />
            <SliderRow
              label="City marker border"
              value={settings.cityMarkerStrokeWidth}
              min={LOCAL_DISPLAY_LIMITS.cityMarkerStrokeWidth.min}
              max={LOCAL_DISPLAY_LIMITS.cityMarkerStrokeWidth.max}
              step={0.5}
              onChange={(cityMarkerStrokeWidth) => updateSettings({ cityMarkerStrokeWidth })}
            />
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-1.5 py-1.5 font-mono text-[9px] tracking-wider uppercase"
              onClick={resetSettings}
            >
              <RotateCcw className="h-3 w-3" />
              Reset defaults
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        title="Display settings (local only)"
        className={`btn-icon h-8 w-8 ${open ? 'btn-icon-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
