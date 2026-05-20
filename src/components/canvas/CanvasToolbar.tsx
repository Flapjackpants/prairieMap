import {
  Hand,
  Paintbrush,
  PaintBucket,
  Type,
  MousePointer2,
  Link2,
  Plus,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import type { ToolMode } from '../../types/project';

const TOOLS: { id: ToolMode; icon: typeof Hand; label: string }[] = [
  { id: 'pan', icon: Hand, label: 'Pan (Space + drag)' },
  { id: 'brush', icon: Paintbrush, label: 'Brush' },
  { id: 'bucket', icon: PaintBucket, label: 'Fill' },
  { id: 'text', icon: Type, label: 'Text label' },
  { id: 'select', icon: MousePointer2, label: 'Select' },
];

export function CanvasToolbar() {
  const {
    state,
    setTool,
    setBrushSize,
    setBrushOpacity,
    setActiveColor,
    toggleCarryLabels,
    addPaletteColor,
  } = useProject();
  const { tool, brushSize, brushOpacity, palette, activeColorId, carryOverLabels } = state;

  return (
    <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-raised/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => setTool(id)}
            className={`btn-icon ${tool === id ? 'btn-icon-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <button
          type="button"
          title={carryOverLabels ? 'Labels carry to next frames' : 'Labels do not carry'}
          onClick={toggleCarryLabels}
          className={`btn-icon ${carryOverLabels ? 'btn-icon-active' : ''}`}
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>

      {(tool === 'brush' || tool === 'bucket') && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          {tool === 'brush' && (
            <>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Size
                <input
                  type="range"
                  min={4}
                  max={80}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-20 accent-accent-cyan"
                />
                <span className="w-6 font-mono text-accent-cyan">{brushSize}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Opacity
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(Number(e.target.value))}
                  className="w-20 accent-accent-cyan"
                />
                <span className="w-8 font-mono text-accent-cyan">
                  {Math.round(brushOpacity * 100)}%
                </span>
              </label>
            </>
          )}

          <div className="flex items-center gap-1.5">
            {palette.map((color) => (
              <button
                key={color.id}
                type="button"
                title={color.name}
                onClick={() => setActiveColor(color.id)}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  activeColorId === color.id
                    ? 'border-white scale-110 ring-2 ring-accent-cyan/50'
                    : 'border-border'
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
            <button
              type="button"
              title="Add faction color"
              className="btn-icon h-7 w-7"
              onClick={() => {
                const name = prompt('Faction name:', 'New Faction');
                if (!name) return;
                const hex = prompt('Color hex:', '#00e5ff');
                if (hex) addPaletteColor(name, hex);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
