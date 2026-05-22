import {
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { usePlayback } from '../../hooks/usePlayback';

export function PlaybackControls() {
  const { state, setTimelineIndex, nextFrame, prevFrame } = useProject();
  const { timeline, currentTimelineIndex } = state;
  const { isPlaying, canPlay, togglePlay, goToStart, goToEnd } = usePlayback();

  const hasFrames = timeline.length > 0;

  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-metal-shadow bg-surface-overlay px-3 py-2">
      <span className="led mr-1 hidden sm:inline" aria-hidden />
      <span className="mr-2 hidden font-mono text-[9px] tracking-widest text-text-muted uppercase sm:inline">
        Transport
      </span>

      <button
        type="button"
        className="btn-icon h-8 w-8"
        disabled={!hasFrames}
        onClick={goToStart}
        title="First frame"
      >
        <ChevronFirst className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="btn-icon h-8 w-8"
        disabled={!hasFrames || currentTimelineIndex === 0}
        onClick={prevFrame}
        title="Previous frame"
      >
        <SkipBack className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={`btn-icon relative h-9 w-9 ${isPlaying ? 'btn-icon-active' : ''}`}
        disabled={!canPlay}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <>
            <Pause className="h-4 w-4" />
            <span className="led led-on absolute -top-0.5 -right-0.5" aria-hidden />
          </>
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        className="btn-icon h-8 w-8"
        disabled={!hasFrames || currentTimelineIndex >= timeline.length - 1}
        onClick={nextFrame}
        title="Next frame"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="btn-icon h-8 w-8"
        disabled={!hasFrames}
        onClick={goToEnd}
        title="Last frame"
      >
        <ChevronLast className="h-3.5 w-3.5" />
      </button>

      <div className="ml-3 flex min-w-[140px] flex-1 items-center gap-2 border-l border-metal-shadow pl-3">
        <input
          type="range"
          min={0}
          max={Math.max(0, timeline.length - 1)}
          value={currentTimelineIndex}
          disabled={!hasFrames}
          onChange={(e) => setTimelineIndex(Number(e.target.value))}
          className="flex-1 accent-accent-orange disabled:opacity-40"
        />
        <span className="font-mono text-[10px] tracking-widest text-accent-cyan tabular-nums whitespace-nowrap uppercase">
          {hasFrames
            ? `${String(currentTimelineIndex + 1).padStart(2, '0')}/${String(timeline.length).padStart(2, '0')}`
            : 'NO_DATA'}
        </span>
        {isPlaying && <span className="led led-on" title="Playing" aria-hidden />}
      </div>
    </div>
  );
}
