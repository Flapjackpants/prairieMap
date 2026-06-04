import { Hand, Hexagon, Link2, MousePointer2, Plus, Trash2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import type { ToolMode, TerritoryDrawMode } from '../../types/project';
import { extensionColorForCountry } from '../../utils/colorUtils';

const TOOLS: { id: ToolMode; icon: typeof Hand; label: string; shortcut: string }[] = [
  { id: 'pan', icon: Hand, label: 'Pan (Space or middle-drag)', shortcut: 'PAN' },
  { id: 'areaSelect', icon: Hexagon, label: 'Area select — click anchors, Enter to close', shortcut: 'SEL' },
  { id: 'select', icon: MousePointer2, label: 'Select territory', shortcut: 'PTR' },
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
    setTerritoryDrawMode,
    currentFrame,
  } = useProject();
  const { tool, palette, activeColorId, carryOverLabels, selectedCountryId, territoryDrawMode } =
    state;
  const activeFaction = palette.find((c) => c.id === activeColorId);
  const selectedCountry = selectedCountryId
    ? currentFrame?.frameData.annotations.countries.find((c) => c.id === selectedCountryId)
    : undefined;

  return (
    <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
      <div className="hw-module">
        <span className="font-mono text-[9px] tracking-widest text-text-muted uppercase">Nation</span>
        <div className="flex items-center gap-1">
          {palette.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.name}
              onClick={() => {
                setActiveColor(color.id);
                if (tool === 'pan') setTool('areaSelect');
              }}
              className={`relative h-7 min-w-[1.75rem] border-2 px-1 font-mono text-[8px] font-bold tracking-wider uppercase transition-all ${
                activeColorId === color.id
                  ? 'border-accent-orange scale-105 neon-glow-orange'
                  : 'border-metal-shadow'
              }`}
              style={{ backgroundColor: color.hex, color: '#fff', textShadow: '0 1px 2px #000' }}
            >
              {activeColorId === color.id && (
                <span className="led led-on absolute -top-0.5 -right-0.5" aria-hidden />
              )}
              {color.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            title="Add faction"
            className="btn-icon h-7 w-7"
            onClick={() => {
              const name = prompt('Faction / country name:', 'New Nation');
              if (!name) return;
              const hex = prompt('Color hex:', '#448aff');
              if (hex) addPaletteColor(name, hex);
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {selectedCountry && (
          <>
            <div className="mx-0.5 h-7 w-px bg-border" />
            <span className="font-mono text-[8px] tracking-widest text-text-muted uppercase">
              Draw
            </span>
            {(
              [
                { mode: 'primary' as TerritoryDrawMode, label: 'PRI', title: 'Primary fill, label moves' },
                { mode: 'extend' as TerritoryDrawMode, label: 'EXT', title: 'Lighter fill, label stays' },
              ] as const
            ).map(({ mode, label, title }) => {
              const isExtend = mode === 'extend';
              const bg = isExtend
                ? extensionColorForCountry(selectedCountry.color, selectedCountry.extensionColor)
                : selectedCountry.color;
              const active = territoryDrawMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  title={title}
                  onClick={() => setTerritoryDrawMode(mode)}
                  className={`relative h-7 min-w-[2rem] border-2 px-1 font-mono text-[8px] font-bold tracking-wider uppercase transition-all ${
                    active ? 'border-accent-cyan scale-105 neon-glow-cyan' : 'border-metal-shadow'
                  }`}
                  style={{ backgroundColor: bg, color: '#fff', textShadow: '0 1px 2px #000' }}
                >
                  {active && (
                    <span className="led led-on absolute -top-0.5 -right-0.5" aria-hidden />
                  )}
                  {label}
                </button>
              );
            })}
          </>
        )}

        <div className="mx-0.5 hidden h-7 w-px bg-border sm:block" />

        {TOOLS.map(({ id, icon: Icon, label, shortcut }) => (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => setTool(id)}
            className={`btn-icon relative h-8 w-auto min-w-[2.25rem] flex-col gap-0 py-0.5 ${tool === id ? 'btn-icon-active' : ''}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="font-mono text-[7px] tracking-wider leading-none">{shortcut}</span>
          </button>
        ))}

        <div className="mx-0.5 h-6 w-px bg-border" />

        <button
          type="button"
          title={carryOverLabels ? 'Territories carry to next frames' : 'Territories do not carry'}
          onClick={toggleCarryLabels}
          className={`btn-icon relative h-8 w-8 ${carryOverLabels ? 'btn-icon-active' : ''}`}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>

        {selectedCountryId && (
          <button
            type="button"
            title="Delete selected territory"
            className="btn-icon h-8 w-8 hover:!text-accent-crimson"
            onClick={() => {
              if (confirm('Delete this country and all its regions?')) {
                deleteCountry(selectedCountryId);
                setSelectedCountry(null);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {tool === 'areaSelect' && activeFaction && (
        <p className="max-w-md border border-accent-cyan/30 bg-surface-overlay/95 px-3 py-1 font-mono text-[9px] tracking-wide text-accent-cyan uppercase shadow-lg">
          Draw::PRI=label moves · EXT=lighter, label stays · Enter=close
        </p>
      )}
      {tool === 'select' && activeFaction && (
        <p className="max-w-md border border-accent-orange/30 bg-surface-overlay/95 px-3 py-1 font-mono text-[9px] tracking-wide text-accent-orange uppercase shadow-lg">
          Anchors: click=remove from selected nation · Drag=move · Alt+click=delete
        </p>
      )}
    </div>
  );
}
