import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { FactionFlagSelect } from './FactionFlagSelect';

export function FactionManager() {
  const { state, updateFactionMetadata } = useProject();
  const { palette } = state;
  const [expanded, setExpanded] = useState(true);

  if (palette.length === 0) return null;

  return (
    <section className="border-t border-metal-shadow pt-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`led ${expanded ? 'led-on' : ''}`} aria-hidden />
        <Settings2 className="h-3.5 w-3.5 text-accent-orange" />
        <span className="font-mono text-[10px] font-semibold tracking-widest text-text-primary uppercase">
          [[ Nation_Registry ]]
        </span>
        <span className="ml-auto font-mono text-[10px] tracking-widest text-accent-cyan">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <ul className="space-y-2">
          {palette.map((faction) => (
            <li
              key={faction.id}
              className="border border-metal-shadow bg-surface p-2.5"
              style={{ borderLeftColor: faction.hex, borderLeftWidth: 3 }}
            >
              <label className="mb-1.5 block">
                <span className="mb-0.5 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                  Designation
                </span>
                <input
                  className="input-field py-1 text-[10px]"
                  value={faction.name}
                  onChange={(e) =>
                    updateFactionMetadata(faction.id, { name: e.target.value })
                  }
                />
              </label>
              <label className="mb-1.5 block">
                <span className="mb-0.5 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                  Chroma
                </span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={faction.hex}
                    onChange={(e) =>
                      updateFactionMetadata(faction.id, { hex: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer border border-metal-shadow bg-transparent"
                  />
                  <input
                    className="input-field flex-1 py-1 text-[10px] normal-case"
                    value={faction.hex}
                    onChange={(e) =>
                      updateFactionMetadata(faction.id, { hex: e.target.value })
                    }
                  />
                </div>
              </label>
              <FactionFlagSelect factionId={faction.id} flagFilename={faction.flagFilename} />
              <p className="mt-2 font-mono text-[9px] leading-relaxed tracking-wide text-text-muted uppercase">
                Syncs fill, borders, labels, and flag on all frames.
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
