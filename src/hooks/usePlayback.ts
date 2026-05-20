import { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '../context/ProjectContext';

const DEFAULT_INTERVAL_MS = 2000;

export function usePlayback(intervalMs = DEFAULT_INTERVAL_MS) {
  const { state, setTimelineIndex, nextFrame } = useProject();
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frameCount = state.timeline.length;
  const canPlay = frameCount > 1;
  const isAtEnd = state.currentTimelineIndex >= frameCount - 1;

  const play = useCallback(() => {
    if (!canPlay) return;
    setIsPlaying(true);
  }, [canPlay]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  useEffect(() => {
    if (!isPlaying || !canPlay) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (state.currentTimelineIndex >= frameCount - 1) {
        setIsPlaying(false);
        return;
      }
      nextFrame();
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, canPlay, frameCount, intervalMs, nextFrame, state.currentTimelineIndex]);

  return {
    isPlaying,
    canPlay,
    isAtEnd,
    play,
    pause,
    togglePlay,
    goToStart: () => setTimelineIndex(0),
    goToEnd: () => setTimelineIndex(frameCount - 1),
  };
}
