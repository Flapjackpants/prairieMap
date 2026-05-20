import { Film, ImageIcon } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export function FrameSidebar() {
  const { state, currentFrame, setFrameIndex } = useProject();
  const { frames, currentFrameIndex } = state;

  return (
    <aside className="panel border-r-0 border-l-0">
      <div className="panel-header">
        <Film className="h-4 w-4 text-accent-cyan" />
        <span className="text-sm font-semibold tracking-wide uppercase">Timeline</span>
        <span className="ml-auto font-mono text-xs text-text-muted">
          {frames.length > 0 ? `${currentFrameIndex + 1}/${frames.length}` : '—'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <ImageIcon className="h-10 w-10 text-border-bright" />
            <p className="text-sm text-text-muted">
              Load a folder of map images to begin your chronology.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {frames.map((frame, index) => {
              const isActive = index === currentFrameIndex;
              return (
                <li key={frame.id}>
                  <button
                    type="button"
                    onClick={() => setFrameIndex(index)}
                    className={`group flex w-full items-center gap-2 rounded border p-1.5 text-left transition-all ${
                      isActive
                        ? 'border-accent-cyan/50 bg-accent-cyan/10 neon-glow'
                        : 'border-transparent hover:border-border hover:bg-surface-overlay'
                    }`}
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-border bg-surface">
                      <img
                        src={frame.objectUrl}
                        alt={frame.filename}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-0 left-0 bg-surface/90 px-1 font-mono text-[10px] text-accent-cyan">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-text-primary">
                        Frame {index + 1}
                      </p>
                      <p className="truncate font-mono text-[10px] text-text-muted">
                        {frame.filename}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {currentFrame && (
        <div className="border-t border-border px-3 py-2">
          <p className="truncate font-mono text-[10px] text-text-muted">ACTIVE</p>
          <p className="truncate text-xs font-medium text-accent-cyan">{currentFrame.filename}</p>
        </div>
      )}
    </aside>
  );
}
