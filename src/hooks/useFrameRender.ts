import type Konva from 'konva';
import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { MapRenderSnapshot } from '../components/canvas/MapRenderStage';
import { useProject } from '../context/ProjectContext';
import type { FrameRenderOptions } from '../types/renderOptions';
import { waitForExportPaint } from '../utils/exportCapture';
import { resolveTimelineEntry } from '../utils/projectHelpers';
import {
  buildRenderSnapshot,
  loadRenderSnapshotAssets,
  MAX_EXPORT_DIMENSION,
} from '../utils/renderSnapshot';
import { downloadBlob } from '../utils/downloadBlob';

export function useFrameRender() {
  const { state } = useProject();
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MapRenderSnapshot | null>(null);
  const [renderOptions, setRenderOptions] = useState<FrameRenderOptions | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const runRender = useCallback(
    async (options: FrameRenderOptions) => {
      const frameIndex = state.currentTimelineIndex;
      const resolved = resolveTimelineEntry(state, frameIndex);
      if (!resolved || resolved.isMissing) {
        setError('Current frame is not available');
        return;
      }

      setIsRendering(true);
      setError(null);

      try {
        const assets = await loadRenderSnapshotAssets(state, frameIndex);
        if (!assets) {
          setError('Current frame is not available');
          return;
        }

        const snap = buildRenderSnapshot(
          state,
          frameIndex,
          assets,
          MAX_EXPORT_DIMENSION,
          options,
        );
        if (!snap) {
          setError('Current frame is not available');
          return;
        }

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
