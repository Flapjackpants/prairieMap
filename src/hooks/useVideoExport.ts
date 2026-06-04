import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { compileVideo } from '../api/backend';
import { DEFAULT_SECONDS_PER_FRAME } from '../constants/playback';
import type { ExportFrameSnapshot } from '../components/canvas/ExportFrameStage';
import { useProject } from '../context/ProjectContext';
import { resolveTimelineEntry } from '../utils/projectHelpers';
import { isBlankAssetKey } from '../types/project';
import { citiesForSegment, interpolateDivisions } from '../utils/markerInterpolation';

const MAX_EXPORT_DIMENSION = 1920;
const MOTION_SUBSTEPS = 12;

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
        const exportableIndices = timeline
          .map((_, i) => i)
          .filter((i) => {
            const r = resolveTimelineEntry(state, i);
            return r && !r.isMissing;
          });

        for (const i of exportableIndices) {
          const resolved = resolveTimelineEntry(state, i)!;
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
        exportW = Math.max(2, exportW - (exportW % 2));
        exportH = Math.max(2, exportH - (exportH % 2));

        const captureSnapshot = async (snap: ExportFrameSnapshot) => {
          setSnapshot(snap);
          await waitFrames(4);
          const stage = stageRef.current;
          if (!stage) throw new Error('Export stage not ready');
          const canvas = stage.toCanvas({ pixelRatio: 1 });
          return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('Failed to capture frame'))),
              'image/png',
            );
          });
        };

        const buildSnap = async (
          resolved: NonNullable<ReturnType<typeof resolveTimelineEntry>>,
          cities: ExportFrameSnapshot['cities'],
          divisions: ExportFrameSnapshot['divisions'],
        ): Promise<ExportFrameSnapshot> => {
          let image: HTMLImageElement | null = null;
          if (resolved.objectUrl && !resolved.isBlank && !isBlankAssetKey(resolved.filename)) {
            try {
              image = await loadImage(resolved.objectUrl);
            } catch {
              image = null;
            }
          }
          return {
            width: exportW,
            height: exportH,
            mapWidth: resolved.canvasWidth,
            mapHeight: resolved.canvasHeight,
            image,
            countries: resolved.frameData.annotations.countries,
            cities,
            divisions,
            dateTitle: resolved.frameData.info.dateTitle,
            eventLog: resolved.frameData.info.description,
          };
        };

        const totalCaptures =
          exportableIndices.length <= 1
            ? 1
            : (exportableIndices.length - 1) * MOTION_SUBSTEPS;
        let captureCount = 0;

        if (exportableIndices.length === 1) {
          const resolved = resolveTimelineEntry(state, exportableIndices[0])!;
          const snap = await buildSnap(
            resolved,
            resolved.frameData.annotations.cities,
            resolved.frameData.annotations.divisions,
          );
          blobs.push(await captureSnapshot(snap));
          captureCount = 1;
        } else {
          for (let j = 0; j < exportableIndices.length - 1; j++) {
            if (abortRef.current) break;
            const from = resolveTimelineEntry(state, exportableIndices[j])!;
            const to = resolveTimelineEntry(state, exportableIndices[j + 1])!;
            for (let k = 0; k < MOTION_SUBSTEPS; k++) {
              if (abortRef.current) break;
              const t = (k + 1) / MOTION_SUBSTEPS;
              const citiesSeg = citiesForSegment(
                from.frameData.annotations.cities,
                to.frameData.annotations.cities,
                t,
              );
              const divsSeg = interpolateDivisions(
                from.frameData.annotations.divisions,
                to.frameData.annotations.divisions,
                t,
              );
              const snap = await buildSnap(to, citiesSeg, divsSeg);
              blobs.push(await captureSnapshot(snap));
              captureCount += 1;
              setProgress(Math.round((captureCount / totalCaptures) * 90));
            }
          }
        }

        if (abortRef.current || blobs.length === 0) {
          setError(abortRef.current ? 'Export cancelled' : 'No frames to export');
          return;
        }

        setProgress(95);
        const frameDuration =
          exportableIndices.length <= 1
            ? secondsPerFrame
            : secondsPerFrame / MOTION_SUBSTEPS;
        const mp4 = await compileVideo(blobs, frameDuration);
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
