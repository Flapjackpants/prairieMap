import { Flag, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';

export function FactionManager() {
  const { state, updateFactionMetadata } = useProject();
  const { palette } = state;
  const [expanded, setExpanded] = useState(true);

  if (palette.length === 0) return null;

  return (
    <section className="border-t border-border pt-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <Settings2 className="h-4 w-4 text-accent-cyan" />
        <span className="text-xs font-semibold tracking-wide uppercase">Manage Nations</span>
        <span className="ml-auto font-mono text-[10px] text-text-muted">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <ul className="space-y-2">
          {palette.map((faction) => (
            <li
              key={faction.id}
              className="rounded border border-border bg-surface p-2.5"
              style={{ borderLeftColor: faction.hex, borderLeftWidth: 3 }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-text-muted" />
                <span className="font-mono text-[10px] text-text-muted">FACTION</span>
              </div>
              <label className="mb-1.5 block">
                <span className="mb-0.5 block font-mono text-[10px] text-text-muted">Name</span>
                <input
                  className="input-field py-1 text-xs uppercase"
                  value={faction.name}
                  onChange={(e) =>
                    updateFactionMetadata(faction.id, { name: e.target.value })
                  }
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block font-mono text-[10px] text-text-muted">Color</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={faction.hex}
                    onChange={(e) =>
                      updateFactionMetadata(faction.id, { hex: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <input
                    className="input-field flex-1 py-1 font-mono text-xs"
                    value={faction.hex}
                    onChange={(e) =>
                      updateFactionMetadata(faction.id, { hex: e.target.value })
                    }
                  />
                </div>
              </label>
              <p className="mt-2 text-[10px] text-text-muted">
                Updates fill, borders, and labels on every frame for this nation.
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
