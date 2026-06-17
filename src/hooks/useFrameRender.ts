import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { MapRenderSnapshot } from '../components/canvas/MapRenderStage';
import { useProject } from '../context/ProjectContext';
import { isBlankAssetKey } from '../types/project';
import type { FrameRenderOptions } from '../types/renderOptions';
import { resolveTimelineEntry } from '../utils/projectHelpers';
import { acquire } from '../utils/mapImageCache';
import { preloadDivisionImages, preloadFlagImages, waitForExportPaint } from '../utils/exportCapture';

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

function evenExportDimensions(width: number, height: number) {
  let exportW = width;
  let exportH = height;
  const scaleDown = Math.min(1, MAX_EXPORT_DIMENSION / Math.max(exportW, exportH));
  exportW = Math.round(exportW * scaleDown);
  exportH = Math.round(exportH * scaleDown);
  exportW = Math.max(2, exportW - (exportW % 2));
  exportH = Math.max(2, exportH - (exportH % 2));
  return { exportW, exportH };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useFrameRender() {
  const { state } = useProject();
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MapRenderSnapshot | null>(null);
  const [renderOptions, setRenderOptions] = useState<FrameRenderOptions | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const runRender = useCallback(
    async (options: FrameRenderOptions) => {
      const resolved = resolveTimelineEntry(state, state.currentTimelineIndex);
      if (!resolved || resolved.isMissing) {
        setError('Current frame is not available');
        return;
      }

      setIsRendering(true);
      setError(null);

      try {
        const { exportW, exportH } = evenExportDimensions(
          resolved.canvasWidth,
          resolved.canvasHeight,
        );

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

        const divisionImages = await preloadDivisionImages(
          state.fileRegistry,
          resolved.frameData.annotations.divisions,
        );
        const flagImages = await preloadFlagImages(state.fileRegistry, state.palette);

        const snap: MapRenderSnapshot = {
          width: exportW,
          height: exportH,
          mapWidth: resolved.canvasWidth,
          mapHeight: resolved.canvasHeight,
          image,
          countries: resolved.frameData.annotations.countries,
          cities: resolved.frameData.annotations.cities,
          divisions: resolved.frameData.annotations.divisions,
          dateTitle: resolved.frameData.info.dateTitle,
          eventLog: resolved.frameData.info.description,
          palette: state.palette,
          displaySettings: state.displaySettings,
          divisionImages,
          flagImages,
        };

        flushSync(() => {
          setRenderOptions(options);
          setSnapshot(snap);
        });

        await waitForExportPaint(8);
        const stage = stageRef.current;
        if (!stage) throw new Error('Render stage not ready');

        const canvas = stage.toCanvas({ pixelRatio: 1 });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Failed to capture frame'))),
            'image/png',
          );
        });

        const safeName = state.projectName.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'frame';
        downloadBlob(blob, `prairiemap-${safeName}.png`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Render failed');
      } finally {
        setIsRendering(false);
        setSnapshot(null);
        setRenderOptions(null);
      }
    },
    [state],
  );

  return {
    isRendering,
    error,
    runRender,
    snapshot,
    renderOptions,
    stageRef,
  };
}
