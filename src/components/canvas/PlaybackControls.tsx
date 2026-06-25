import { useState } from 'react';
import {
  Camera,
  ChevronFirst,
  ChevronLast,
  Circle,
  Clapperboard,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { usePlayback } from '../../hooks/usePlayback';
import { useVideoExport } from '../../hooks/useVideoExport';
import { useFrameRender } from '../../hooks/useFrameRender';
import { ExportFrameStage } from './ExportFrameStage';
import { ExportVideoModal } from './ExportVideoModal';
import { GenerateRenderModal } from './GenerateRenderModal';
import { MapRenderStage } from './MapRenderStage';
import { MinecraftRecordModal } from './MinecraftRecordModal';
import { useMinecraftRecording } from '../../context/MinecraftRecordingContext';

export function PlaybackControls() {
  const { state, setTimelineIndex, nextFrame, prevFrame, apiReady } = useProject();
  const { openModal } = useMinecraftRecording();
  const { timeline, currentTimelineIndex } = state;
  const { isPlaying, canPlay, togglePlay, goToStart, goToEnd } = usePlayback();
  const video = useVideoExport();
  const frameRender = useFrameRender();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRenderModal, setShowRenderModal] = useState(false);

  const hasFrames = timeline.length > 0;

  const handleCompileClick = () => {
    if (!apiReady) {
      alert('Start the API server: npm run dev:api (or npm run dev:all)');
      return;
    }
    setShowExportModal(true);
  };

  return (
    <>
      <ExportFrameStage snapshot={video.snapshot} stageRef={video.stageRef} />
      {frameRender.snapshot && frameRender.renderOptions && (
        <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0" aria-hidden>
          <MapRenderStage
            snapshot={frameRender.snapshot}
            renderOptions={frameRender.renderOptions}
            stageRef={frameRender.stageRef}
          />
        </div>
      )}
      {showExportModal && (
        <ExportVideoModal
          frameCount={timeline.length}
          isExporting={video.isExporting}
          progress={video.progress}
          captureLabel={video.captureLabel}
          error={video.error}
          onConfirm={(seconds, divisionMotionFps) => {
            void video
              .runExport(seconds, divisionMotionFps)
              .finally(() => setShowExportModal(false));
          }}
          onCancel={() => {
            video.cancel();
            setShowExportModal(false);
          }}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showRenderModal && (
        <GenerateRenderModal
          isRendering={frameRender.isRendering}
          error={frameRender.error}
          onRender={(options) => {
            void frameRender.runRender(options).finally(() => setShowRenderModal(false));
          }}
          onClose={() => setShowRenderModal(false)}
        />
      )}

      <MinecraftRecordModal />

      <div className="shrink-0 border-t border-metal-shadow bg-surface-overlay px-2 py-2">
        <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5">
          <div className="flex shrink-0 items-center gap-1">
            <span className="led mr-0.5 hidden sm:inline" aria-hidden />
            <span className="mr-1 hidden font-mono text-[9px] tracking-widest text-text-muted uppercase lg:inline">
              Transport
            </span>

            <button
              type="button"
              className="btn-icon h-8 w-8 shrink-0"
              disabled={!hasFrames}
              onClick={goToStart}
              title="First frame"
            >
              <ChevronFirst className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="btn-icon h-8 w-8 shrink-0"
              disabled={!hasFrames || currentTimelineIndex === 0}
              onClick={() => void prevFrame()}
              title="Previous frame"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`btn-icon relative h-9 w-9 shrink-0 ${isPlaying ? 'btn-icon-active' : ''}`}
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
              className="btn-icon h-8 w-8 shrink-0"
              disabled={!hasFrames || currentTimelineIndex >= timeline.length - 1}
              onClick={() => void nextFrame()}
              title="Next frame"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="btn-icon h-8 w-8 shrink-0"
              disabled={!hasFrames}
              onClick={goToEnd}
              title="Last frame"
            >
              <ChevronLast className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className={`btn-icon flex h-8 shrink-0 items-center gap-1 px-2 ${
                hasFrames && apiReady ? 'text-accent-crimson' : ''
              }`}
              disabled={!hasFrames || !apiReady}
              onClick={() => openModal()}
              title="Capture Minecraft player positions to JSON"
            >
              <Circle className="h-4 w-4 shrink-0" />
              <span className="font-mono text-[8px] font-bold tracking-wider">REC</span>
            </button>

            <button
              type="button"
              className={`btn-icon flex h-8 shrink-0 items-center gap-1 px-2 ${
                hasFrames && !frameRender.isRendering ? 'text-accent-cyan' : ''
              }`}
              disabled={!hasFrames || frameRender.isRendering}
              onClick={() => setShowRenderModal(true)}
              title="Generate PNG of current frame"
            >
              <Camera className="h-4 w-4 shrink-0" />
              <span className="font-mono text-[8px] font-bold tracking-wider">PNG</span>
            </button>

            <button
              type="button"
              className={`btn-icon flex h-8 shrink-0 items-center gap-1 px-2 ${
                hasFrames && !video.isExporting ? 'text-accent-orange' : ''
              }`}
              disabled={!hasFrames || video.isExporting}
              onClick={handleCompileClick}
              title="Compile timeline to MP4 (requires API + ffmpeg)"
            >
              <Clapperboard className="h-4 w-4 shrink-0" />
              <span className="font-mono text-[8px] font-bold tracking-wider">VID</span>
            </button>
          </div>

          <div className="flex min-w-[140px] flex-1 items-center gap-2 border-l border-metal-shadow pl-2">
            <input
              type="range"
              min={0}
              max={Math.max(0, timeline.length - 1)}
              value={currentTimelineIndex}
              disabled={!hasFrames}
              onChange={(e) => void setTimelineIndex(Number(e.target.value))}
              className="min-w-[80px] flex-1 accent-accent-orange disabled:opacity-40"
            />
            <span className="shrink-0 font-mono text-[10px] tracking-widest text-accent-cyan tabular-nums whitespace-nowrap uppercase">
              {hasFrames
                ? `${String(currentTimelineIndex + 1).padStart(2, '0')}/${String(timeline.length).padStart(2, '0')}`
                : 'NO_DATA'}
            </span>
            {isPlaying && <span className="led led-on shrink-0" title="Playing" aria-hidden />}
          </div>
        </div>
      </div>
    </>
  );
}
