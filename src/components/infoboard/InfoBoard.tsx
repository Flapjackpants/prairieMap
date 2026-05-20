import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useProject } from '../../context/ProjectContext';
import type { FactionStat } from '../../types/project';

export function InfoBoard() {
  const { state, currentFrame, updateFrameInfo } = useProject();
  const info = currentFrame?.frameData.info;
  const { palette } = state;

  const updateStat = (id: string, field: Partial<FactionStat>) => {
    if (!info) return;
    updateFrameInfo({
      factionStats: info.factionStats.map((s) => (s.id === id ? { ...s, ...field } : s)),
    });
  };

  const addStat = () => {
    if (!info || palette.length === 0) return;
    const stat: FactionStat = {
      id: uuidv4(),
      factionId: palette[0].id,
      metric: 'casualties',
      value: '0',
    };
    updateFrameInfo({ factionStats: [...info.factionStats, stat] });
  };

  const removeStat = (id: string) => {
    if (!info) return;
    updateFrameInfo({
      factionStats: info.factionStats.filter((s) => s.id !== id),
    });
  };

  return (
    <aside className="panel border-r-0">
      <div className="panel-header">
        <BookOpen className="h-4 w-4 text-accent-cyan" />
        <span className="text-sm font-semibold tracking-wide uppercase">Intel Board</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {!currentFrame ? (
          <p className="text-center text-sm text-text-muted py-8">
            Select a frame to edit intelligence data.
          </p>
        ) : (
          <>
            <section>
              <label className="mb-1 block font-mono text-[10px] tracking-wider text-text-muted uppercase">
                Date / Era
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. September 1939"
                value={info?.dateTitle ?? ''}
                onChange={(e) => updateFrameInfo({ dateTitle: e.target.value })}
              />
            </section>

            <section className="flex min-h-0 flex-1 flex-col">
              <label className="mb-1 block font-mono text-[10px] tracking-wider text-text-muted uppercase">
                Event Log (Markdown)
              </label>
              <textarea
                className="input-field min-h-[180px] flex-1 resize-none font-mono text-xs leading-relaxed"
                placeholder="## Offensive begins&#10;&#10;Forces advanced across the northern front..."
                value={info?.description ?? ''}
                onChange={(e) => updateFrameInfo({ description: e.target.value })}
              />
              {info?.description && (
                <div className="mt-2 rounded border border-border bg-surface p-2">
                  <p className="mb-1 font-mono text-[10px] text-accent-cyan">PREVIEW</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-text-primary">
                    {info.description}
                  </pre>
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <label className="font-mono text-[10px] tracking-wider text-text-muted uppercase">
                  Faction Stats
                </label>
                <button type="button" className="btn-icon h-7 w-7" onClick={addStat} title="Add stat">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <ul className="space-y-2">
                {info?.factionStats.length === 0 && (
                  <li className="text-center text-xs text-text-muted py-2">No stats yet</li>
                )}
                {info?.factionStats.map((stat) => {
                  const faction = palette.find((p) => p.id === stat.factionId);
                  return (
                    <li
                      key={stat.id}
                      className="rounded border border-border bg-surface p-2"
                      style={{ borderLeftColor: faction?.hex, borderLeftWidth: 3 }}
                    >
                      <div className="mb-1.5 flex items-center gap-1">
                        <select
                          className="input-field flex-1 py-1 text-xs"
                          value={stat.factionId}
                          onChange={(e) => updateStat(stat.id, { factionId: e.target.value })}
                        >
                          {palette.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-icon h-7 w-7 shrink-0 text-accent-crimson"
                          onClick={() => removeStat(stat.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          className="input-field flex-1 py-1 text-xs"
                          placeholder="metric"
                          value={stat.metric}
                          onChange={(e) => updateStat(stat.id, { metric: e.target.value })}
                        />
                        <input
                          className="input-field flex-1 py-1 text-xs"
                          placeholder="value"
                          value={stat.value}
                          onChange={(e) => updateStat(stat.id, { value: e.target.value })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
