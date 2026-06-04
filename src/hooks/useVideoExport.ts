import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { compileVideo } from '../api/backend';
import { DEFAULT_SECONDS_PER_FRAME } from '../constants/playback';
import type { ExportFrameSnapshot } from '../components/canvas/ExportFrameStage';
import { useProject } from '../context/ProjectContext';
import { resolveTimelineEntry } from '../utils/projectHelpers';
import { isBlankAssetKey } from '../types/project';

const MAX_EXPORT_DIMENSION = 1920;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n += 1;
      if (n >= count) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function useVideoExport() {
  const { state } = useProject();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ExportFrameSnapshot | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const abortRef = useRef(false);

  const runExport = useCallback(
    async (secondsPerFrame = DEFAULT_SECONDS_PER_FRAME) => {
      const { timeline } = state;
      if (timeline.length === 0) {
        setError('No frames in timeline');
        return;
      }

      abortRef.current = false;
      setIsExporting(true);
      setError(null);
      setProgress(0);

      const savedIndex = state.currentTimelineIndex;
      const blobs: Blob[] = [];
      let exportW = 0;
      let exportH = 0;

      try {
        for (let i = 0; i < timeline.length; i++) {
          const resolved = resolveTimelineEntry(state, i);
          if (!resolved || resolved.isMissing) continue;
          exportW = Math.max(exportW, resolved.canvasWidth);
          exportH = Math.max(exportH, resolved.canvasHeight);
        }

        if (exportW === 0 || exportH === 0) {
          exportW = 1920;
          exportH = 1080;
        }

        const scaleDown = Math.min(1, MAX_EXPORT_DIMENSION / Math.max(exportW, exportH));
        exportW = Math.round(exportW * scaleDown);
        exportH = Math.round(exportH * scaleDown);
        // H.264 / yuv420p requires even dimensions
        exportW = Math.max(2, exportW - (exportW % 2));
        exportH = Math.max(2, exportH - (exportH % 2));

        const exportableIndices = timeline
          .map((_, i) => i)
          .filter((i) => {
            const r = resolveTimelineEntry(state, i);
            return r && !r.isMissing;
          });

        for (let j = 0; j < exportableIndices.length; j++) {
          if (abortRef.current) break;
          const i = exportableIndices[j];
          const resolved = resolveTimelineEntry(state, i)!;
          let image: HTMLImageElement | null = null;
          if (resolved.objectUrl && !resolved.isBlank && !isBlankAssetKey(resolved.filename)) {
            try {
              image = await loadImage(resolved.objectUrl);
            } catch {
              image = null;
            }
          }

          setSnapshot({
            width: exportW,
            height: exportH,
            mapWidth: resolved.canvasWidth,
            mapHeight: resolved.canvasHeight,
            image,
            countries: resolved.frameData.annotations.countries,
            dateTitle: resolved.frameData.info.dateTitle,
          });

          await waitFrames(3);
          const stage = stageRef.current;
          if (!stage) throw new Error('Export stage not ready');

          const canvas = stage.toCanvas({ pixelRatio: 1 });
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to capture frame'))), 'image/png');
          });
          blobs.push(blob);
          setProgress(Math.round(((j + 1) / exportableIndices.length) * 90));
        }

        if (abortRef.current || blobs.length === 0) {
          setError(abortRef.current ? 'Export cancelled' : 'No frames to export');
          return;
        }

        setProgress(95);
        const mp4 = await compileVideo(blobs, secondsPerFrame);
        const url = URL.createObjectURL(mp4);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prairiemap-${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        setProgress(100);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Video export failed');
      } finally {
        setSnapshot(null);
        setIsExporting(false);
        void savedIndex;
      }
    },
    [state],
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    isExporting,
    progress,
    error,
    snapshot,
    stageRef,
    runExport,
    cancel,
  };
}
