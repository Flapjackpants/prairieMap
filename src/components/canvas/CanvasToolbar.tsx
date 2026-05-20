import { Hand, Hexagon, Link2, MousePointer2, Plus, Trash2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import type { ToolMode } from '../../types/project';

const TOOLS: { id: ToolMode; icon: typeof Hand; label: string }[] = [
  { id: 'pan', icon: Hand, label: 'Pan (Space + drag)' },
  { id: 'areaSelect', icon: Hexagon, label: 'Area select — click anchors, Enter to close' },
  { id: 'select', icon: MousePointer2, label: 'Select territory' },
];

export function CanvasToolbar() {
  const {
    state,
    setTool,
    setActiveColor,
    toggleCarryLabels,
    addPaletteColor,
    deleteCountry,
    setSelectedCountry,
  } = useProject();
  const { tool, palette, activeColorId, carryOverLabels, selectedCountryId } = state;
  const activeFaction = palette.find((c) => c.id === activeColorId);

  return (
    <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-surface-raised/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="font-mono text-[10px] tracking-wider text-text-muted uppercase">
          Faction
        </span>
        <div className="flex items-center gap-1.5">
          {palette.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.name}
              onClick={() => {
                setActiveColor(color.id);
                if (tool === 'pan') setTool('areaSelect');
              }}
              className={`h-8 min-w-[2rem] rounded-full border-2 px-2 text-[10px] font-bold transition-transform hover:scale-105 ${
                activeColorId === color.id
                  ? 'border-white scale-105 ring-2 ring-accent-cyan/50'
                  : 'border-border'
              }`}
              style={{ backgroundColor: color.hex, color: '#fff', textShadow: '0 1px 2px #000' }}
            >
              {color.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            title="Add faction"
            className="btn-icon h-8 w-8"
            onClick={() => {
              const name = prompt('Faction / country name:', 'New Nation');
              if (!name) return;
              const hex = prompt('Color hex:', '#448aff');
              if (hex) addPaletteColor(name, hex);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

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
          title={carryOverLabels ? 'Territories carry to next frames' : 'Territories do not carry'}
          onClick={toggleCarryLabels}
          className={`btn-icon ${carryOverLabels ? 'btn-icon-active' : ''}`}
        >
          <Link2 className="h-4 w-4" />
        </button>

        {selectedCountryId && (
          <button
            type="button"
            title="Delete selected territory"
            className="btn-icon hover:border-accent-crimson/60 hover:bg-accent-crimson/10 hover:text-accent-crimson"
            onClick={() => {
              if (confirm('Delete this country and all its regions?')) {
                deleteCountry(selectedCountryId);
                setSelectedCountry(null);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {tool === 'areaSelect' && activeFaction && (
        <p className="rounded border border-accent-cyan/30 bg-surface-raised/95 px-3 py-1.5 text-center text-xs text-accent-cyan shadow-lg backdrop-blur-sm">
          Drawing for <strong>{activeFaction.name.toUpperCase()}</strong> — click anchors (snaps to
          borders), Enter to close, Alt+click to remove anchor, overlaps transfer territory
        </p>
      )}
    </div>
  );
}
