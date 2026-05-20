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
    <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-surface-raised px-4 py-2.5">
      <button
        type="button"
        className="btn-icon"
        disabled={!hasFrames}
        onClick={goToStart}
        title="First frame"
      >
        <ChevronFirst className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="btn-icon"
        disabled={!hasFrames || currentTimelineIndex === 0}
        onClick={prevFrame}
        title="Previous frame"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={`btn-icon h-10 w-10 ${isPlaying ? 'btn-icon-active' : ''}`}
        disabled={!canPlay}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
      <button
        type="button"
        className="btn-icon"
        disabled={!hasFrames || currentTimelineIndex >= timeline.length - 1}
        onClick={nextFrame}
        title="Next frame"
      >
        <SkipForward className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="btn-icon"
        disabled={!hasFrames}
        onClick={goToEnd}
        title="Last frame"
      >
        <ChevronLast className="h-4 w-4" />
      </button>

      <div className="ml-4 flex min-w-[120px] flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, timeline.length - 1)}
          value={currentTimelineIndex}
          disabled={!hasFrames}
          onChange={(e) => setTimelineIndex(Number(e.target.value))}
          className="flex-1 accent-accent-cyan disabled:opacity-40"
        />
        <span className="font-mono text-xs text-text-muted whitespace-nowrap">
          {hasFrames ? `${currentTimelineIndex + 1} / ${timeline.length}` : 'No frames'}
        </span>
      </div>
    </div>
  );
}
