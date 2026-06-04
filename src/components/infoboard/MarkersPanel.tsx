import { MapPin, Shield } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';

export function MarkersPanel() {
  const {
    currentFrame,
    state,
    setSelectedMarker,
    setTool,
    removeCityMarker,
    removeDivisionMarker,
    copyMarkers,
    pasteMarkers,
    hasMarkerClipboard,
  } = useProject();
  const [expanded, setExpanded] = useState(true);

  const cities = currentFrame?.frameData.annotations.cities ?? [];
  const divisions = currentFrame?.frameData.annotations.divisions ?? [];

  if (!currentFrame) return null;

  return (
    <section className="border border-border/60 bg-surface/50">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2 py-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={`led ${expanded ? 'led-on' : ''}`} aria-hidden />
        <MapPin className="h-3 w-3 text-accent-cyan" />
        <span className="font-mono text-[10px] font-semibold tracking-widest text-text-primary uppercase">
          Map_Markers
        </span>
        <span className="ml-auto font-mono text-[10px] text-accent-cyan">
          {expanded ? '−' : '+'}
        </span>
      </button>
      {expanded && (
        <div className="space-y-1.5 border-t border-border/60 px-2 py-2">
          <div>
            <span className="font-mono text-[8px] tracking-widest text-text-muted uppercase">
              Cities ({cities.length})
            </span>
            {cities.length === 0 ? (
              <p className="mt-0.5 font-mono text-[9px] text-text-muted">No cities on this frame</p>
            ) : (
              <ul className="mt-0.5 max-h-24 space-y-0.5 overflow-y-auto">
                {cities.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 truncate text-left font-mono text-[10px] ${
                        state.selectedMarkerId === c.id ? 'text-accent-cyan' : 'text-text-primary'
                      }`}
                      onClick={() => {
                        setTool('select');
                        setSelectedMarker(c.id, 'city');
                      }}
                    >
                      {c.name}
                    </button>
                    <button
                      type="button"
                      className="font-mono text-[9px] text-accent-crimson"
                      onClick={() => void removeCityMarker(c.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <span className="font-mono text-[8px] tracking-widest text-text-muted uppercase">
              Divisions ({divisions.length})
            </span>
            {divisions.length === 0 ? (
              <p className="mt-0.5 font-mono text-[9px] text-text-muted">No divisions on this frame</p>
            ) : (
              <ul className="mt-0.5 max-h-24 space-y-0.5 overflow-y-auto">
                {divisions.map((d) => (
                  <li key={d.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 truncate text-left font-mono text-[10px] ${
                        state.selectedMarkerId === d.id ? 'text-accent-cyan' : 'text-text-primary'
                      }`}
                      onClick={() => {
                        setTool('select');
                        setSelectedMarker(d.id, 'division');
                      }}
                    >
                    <Shield className="mr-0.5 inline h-2.5 w-2.5" />
                    {d.name.trim() || d.sourceFilename.split('/').pop()}
                    </button>
                    <button
                      type="button"
                      className="font-mono text-[9px] text-accent-crimson"
                      onClick={() => void removeDivisionMarker(d.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-1 pt-0.5">
            <button
              type="button"
              className="btn-icon h-6 flex-1 font-mono text-[8px] tracking-wider"
              onClick={copyMarkers}
            >
              COPY
            </button>
            <button
              type="button"
              className="btn-icon h-6 flex-1 font-mono text-[8px] tracking-wider"
              disabled={!hasMarkerClipboard}
              onClick={() => void pasteMarkers()}
            >
              PASTE
            </button>
          </div>
          <p className="font-mono text-[8px] leading-snug text-text-muted">
            ⌘C copy (selected or all) · ⌘V paste on frame
          </p>
        </div>
      )}
    </section>
  );
}
