import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useProject } from '../../context/ProjectContext';
import type { FactionStat } from '../../types/project';
import { FactionManager } from './FactionManager';
import { MarkersPanel } from './MarkersPanel';

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
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="panel-header">
        <span className="led led-cyan" aria-hidden />
        <span className="panel-bracket">::</span>
        <BookOpen className="h-3.5 w-3.5 text-accent-cyan" />
        <span className="panel-title">Info_Board</span>
        <span className="font-mono text-[9px] tracking-widest text-text-muted">v2.1</span>
        <span className="panel-bracket">::</span>
      </div>

      <div className="panel-inset panel-scroll flex flex-col gap-3 p-3">
        {!currentFrame ? (
          <p className="py-8 text-center font-mono text-[10px] tracking-widest text-text-muted uppercase">
            :: Select_Frame_For_Intel ::
          </p>
        ) : (
          <>
            <section>
              <label className="mb-1 block font-mono text-[9px] tracking-widest text-text-muted uppercase">
                :: Date_Era ::
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="SEPTEMBER 1939"
                value={info?.dateTitle ?? ''}
                onChange={(e) => updateFrameInfo({ dateTitle: e.target.value })}
              />
            </section>

            <MarkersPanel />

            <section className="flex min-h-0 flex-1 flex-col">
              <label className="mb-1 block font-mono text-[9px] tracking-widest text-accent-cyan uppercase">
                :: Event_Log [MD] ::
              </label>
              <textarea
                className="terminal-screen min-h-[180px] flex-1 resize-none px-2.5 py-2 focus:outline-none"
                placeholder="## OFFENSIVE BEGINS&#10;&#10;FORCES ADVANCED ACROSS THE NORTHERN FRONT..."
                value={info?.description ?? ''}
                onChange={(e) => updateFrameInfo({ description: e.target.value })}
              />
              {info?.description && (
                <div className="terminal-readout mt-2 rounded-none border border-metal-shadow p-2">
                  <p className="mb-1 font-mono text-[9px] tracking-widest text-accent-orange uppercase">
                    &gt; Readout_Preview
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-accent-cyan/90 normal-case">
                    {info.description}
                  </pre>
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <label className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
                  :: Faction_Stats ::
                </label>
                <button type="button" className="btn-icon h-7 w-7" onClick={addStat} title="Add stat">
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {info && info.factionStats.length > 0 && (
                <ul className="mb-3 space-y-1 rounded border border-metal-shadow bg-surface p-2">
                  {info.factionStats.map((stat) => {
                    const faction = palette.find((p) => p.id === stat.factionId);
                    const name = (faction?.name ?? 'UNKNOWN').toUpperCase();
                    const line = `${stat.metric}`.toUpperCase();
                    const val = stat.value;
                    return (
                      <li key={`preview-${stat.id}`} className="stat-leader">
                        <span className="stat-leader-name">
                          {name} · {line}
                        </span>
                        <span className="stat-leader-dots" aria-hidden />
                        <span className="stat-leader-value">{val}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ul className="space-y-2">
                {info?.factionStats.length === 0 && (
                  <li className="py-2 text-center font-mono text-[10px] tracking-widest text-text-muted uppercase">
                    No_Stats
                  </li>
                )}
                {info?.factionStats.map((stat) => {
                  const faction = palette.find((p) => p.id === stat.factionId);
                  return (
                    <li
                      key={stat.id}
                      className="border border-metal-shadow bg-surface p-2"
                      style={{ borderLeftColor: faction?.hex, borderLeftWidth: 3 }}
                    >
                      <div className="mb-1.5 flex items-center gap-1">
                        <select
                          className="input-field flex-1 py-1 text-[10px]"
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
                          className="btn-icon h-7 w-7 shrink-0"
                          onClick={() => removeStat(stat.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          className="input-field flex-1 py-1 text-[10px]"
                          placeholder="METRIC"
                          value={stat.metric}
                          onChange={(e) => updateStat(stat.id, { metric: e.target.value })}
                        />
                        <input
                          className="input-field flex-1 py-1 text-[10px]"
                          placeholder="VALUE"
                          value={stat.value}
                          onChange={(e) => updateStat(stat.id, { value: e.target.value })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <FactionManager />
          </>
        )}
      </div>
    </aside>
  );
}
