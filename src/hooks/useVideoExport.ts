import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { compileVideo } from '../api/backend';
import { formatFetchFailure } from '../api/client';
import { DEFAULT_SECONDS_PER_FRAME } from '../constants/playback';
import type { ExportFrameSnapshot } from '../components/canvas/ExportFrameStage';
import { useProject } from '../context/ProjectContext';
import type { DivisionMarker, ProjectState } from '../types/project';
import { resolveTimelineEntry } from '../utils/projectHelpers';
import { isBlankAssetKey } from '../types/project';
import { downloadBlob, saveBlobToDisk } from '../utils/downloadBlob';
import { preloadDivisionImages, preloadFlagImages, waitForExportPaint } from '../utils/exportCapture';
import { acquire } from '../utils/mapImageCache';
import {
  citiesForSegment,
  easeInOutCubic,
  interpolateDivisions,
  segmentSubstepCount,
} from '../utils/markerInterpolation';

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

function collectDivisionsFromIndices(state: ProjectState, indices: number[]): DivisionMarker[] {
  const all: DivisionMarker[] = [];
  for (const i of indices) {
    const r = resolveTimelineEntry(state, i);
    if (r) all.push(...r.frameData.annotations.divisions);
  }
  return all;
}

export function useVideoExport() {
  const { state } = useProject();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [captureLabel, setCaptureLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ExportFrameSnapshot | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const abortRef = useRef(false);
  const divisionImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const flagImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const pendingVideoRef = useRef<{ blob: Blob; filename: string } | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const clearPendingExport = useCallback(() => {
    pendingVideoRef.current = null;
    setExportComplete(false);
    setSaveMessage(null);
  }, []);

  const savePendingVideo = useCallback(async () => {
    const pending = pendingVideoRef.current;
    if (!pending) return;
    setSaveMessage(null);
    try {
      const result = await saveBlobToDisk(pending.blob, pending.filename);
      if (result === 'saved') {
        setSaveMessage('Video saved to the location you chose.');
      } else if (result === 'downloaded') {
        setSaveMessage('Download started — check your Downloads folder.');
      }
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : 'Could not save video');
    }
  }, []);

  const runExport = useCallback(
    async (
      secondsPerFrame = DEFAULT_SECONDS_PER_FRAME,
      divisionMotionFps = 24,
    ) => {
      const { timeline } = state;
      if (timeline.length === 0) {
        setError('No frames in timeline');
        return;
      }

      abortRef.current = false;
      setIsExporting(true);
      setError(null);
      setProgress(0);
      setCaptureLabel(null);
      clearPendingExport();

      const savedIndex = state.currentTimelineIndex;
      const blobs: Blob[] = [];
      const frameDurations: number[] = [];
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

        divisionImagesRef.current = await preloadDivisionImages(
          state.fileRegistry,
          collectDivisionsFromIndices(state, exportableIndices),
        );
        flagImagesRef.current = await preloadFlagImages(state.fileRegistry, state.palette);

        const captureSnapshot = async (snap: ExportFrameSnapshot) => {
          const snapWithImages: ExportFrameSnapshot = {
            ...snap,
            divisionImages: divisionImagesRef.current,
            flagImages: flagImagesRef.current,
          };
          flushSync(() => setSnapshot(snapWithImages));
          await waitForExportPaint(8);
          const stage = stageRef.current;
          if (!stage) throw new Error('Export stage not ready');
          const canvas = stage.toCanvas({ pixelRatio: 1 });
          return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error('Failed to capture frame'))),
              'image/jpeg',
              0.92,
            );
          });
        };

        const buildSnap = async (
          resolved: NonNullable<ReturnType<typeof resolveTimelineEntry>>,
          cities: ExportFrameSnapshot['cities'],
          divisions: ExportFrameSnapshot['divisions'],
        ): Promise<ExportFrameSnapshot> => {
          let image: HTMLImageElement | null = null;
          if (!resolved.isBlank && !isBlankAssetKey(resolved.filename)) {
            const file = state.fileRegistry[resolved.filename]?.file;
            if (file) {
              try {
                image = await loadImage(acquire(resolved.filename, file));
              } catch {
                image = null;
              }
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
            palette: state.palette,
            displaySettings: state.displaySettings,
          };
        };

        let totalCaptures = 0;
        if (exportableIndices.length === 1) {
          totalCaptures = 1;
        } else {
          totalCaptures = 1;
          for (let j = 0; j < exportableIndices.length - 1; j++) {
            const from = resolveTimelineEntry(state, exportableIndices[j])!;
            const to = resolveTimelineEntry(state, exportableIndices[j + 1])!;
            totalCaptures += segmentSubstepCount(
              secondsPerFrame,
              divisionMotionFps,
              from.frameData.annotations.divisions,
              to.frameData.annotations.divisions,
            );
          }
        }
        let captureCount = 0;

        if (exportableIndices.length === 1) {
          const resolved = resolveTimelineEntry(state, exportableIndices[0])!;
          setCaptureLabel('Capturing 1/1');
          const snap = await buildSnap(
            resolved,
            resolved.frameData.annotations.cities,
            resolved.frameData.annotations.divisions,
          );
          blobs.push(await captureSnapshot(snap));
          frameDurations.push(secondsPerFrame);
          captureCount = 1;
          setProgress(90);
        } else {
          const first = resolveTimelineEntry(state, exportableIndices[0])!;
          setCaptureLabel('Capturing 1/' + totalCaptures);
          const firstSnap = await buildSnap(
            first,
            first.frameData.annotations.cities,
            first.frameData.annotations.divisions,
          );
          blobs.push(await captureSnapshot(firstSnap));
          frameDurations.push(secondsPerFrame);
          captureCount = 1;
          setProgress(Math.round((captureCount / totalCaptures) * 90));

          for (let j = 0; j < exportableIndices.length - 1; j++) {
            if (abortRef.current) break;
            const from = resolveTimelineEntry(state, exportableIndices[j])!;
            const to = resolveTimelineEntry(state, exportableIndices[j + 1])!;
            const substeps = segmentSubstepCount(
              secondsPerFrame,
              divisionMotionFps,
              from.frameData.annotations.divisions,
              to.frameData.annotations.divisions,
            );
            const subDuration = secondsPerFrame / substeps;
            for (let k = 0; k < substeps; k++) {
              if (abortRef.current) break;
              const t =
                substeps === 1 ? 1 : easeInOutCubic(k / (substeps - 1));
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
              captureCount += 1;
              setCaptureLabel(`Capturing ${captureCount}/${totalCaptures}`);
              const mapFrame = t >= 1 ? to : from;
              const snap = await buildSnap(mapFrame, citiesSeg, divsSeg);
              blobs.push(await captureSnapshot(snap));
              frameDurations.push(subDuration);
              setProgress(Math.round((captureCount / totalCaptures) * 90));
            }
          }
        }

        if (abortRef.current || blobs.length === 0) {
          setError(abortRef.current ? 'Export cancelled' : 'No frames to export');
          return;
        }

        if (frameDurations.length !== blobs.length) {
          throw new Error('Export frame duration count mismatch');
        }

        setProgress(95);
        setCaptureLabel('Encoding video…');
        const mp4 = await compileVideo(blobs, secondsPerFrame, frameDurations);
        if (mp4.size === 0) {
          throw new Error('Video encode returned an empty file — is ffmpeg installed?');
        }

        const filename = `prairiemap-${Date.now()}.mp4`;
        pendingVideoRef.current = { blob: mp4, filename };
        setExportComplete(true);
        setProgress(100);
        setCaptureLabel('Export complete');

        try {
          downloadBlob(mp4, filename);
          setSaveMessage('Download started — check your Downloads folder.');
        } catch {
          setSaveMessage('Click “Save MP4” below to download the video.');
        }
      } catch (e) {
        setError(formatFetchFailure(e, 'Video export failed'));
      } finally {
        setSnapshot(null);
        setCaptureLabel(null);
        setIsExporting(false);
        void savedIndex;
      }
    },
    [state, clearPendingExport],
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    clearPendingExport();
  }, [clearPendingExport]);

  return {
    isExporting,
    progress,
    captureLabel,
    error,
    exportComplete,
    saveMessage,
    snapshot,
    stageRef,
    runExport,
    savePendingVideo,
    clearPendingExport,
    cancel,
  };
}
