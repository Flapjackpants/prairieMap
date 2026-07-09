import type Konva from 'konva';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapRenderStage } from './MapRenderStage';
import { useProject } from '../../context/ProjectContext';
import type { FrameRenderOptions } from '../../types/renderOptions';
import {
  buildRenderSnapshot,
  loadRenderSnapshotAssets,
  MAX_PREVIEW_DIMENSION,
  type RenderSnapshotAssets,
} from '../../utils/renderSnapshot';

interface RenderPreviewPanelProps {
  renderOptions: FrameRenderOptions;
  frameIndex?: number;
  disabled?: boolean;
}

function previewStageKey(renderOptions: FrameRenderOptions, snapshotKey: string) {
  return [
    snapshotKey,
    renderOptions.showDossier,
    renderOptions.showActiveDivisions,
    renderOptions.showBackground,
    renderOptions.showDivisions,
    renderOptions.showCities,
    renderOptions.showLabels,
    renderOptions.territoryDisplayMode,
    renderOptions.layout.mapScale,
    renderOptions.layout.dossierWidthFraction,
    renderOptions.layout.dateFontScale,
    renderOptions.layout.eventLogFontScale,
    renderOptions.layout.activeDivisionsIconScale,
    renderOptions.visibleCountryIds?.join(',') ?? 'all',
  ].join('|');
}

export function RenderPreviewPanel({
  renderOptions,
  frameIndex,
  disabled,
}: RenderPreviewPanelProps) {
  const { state } = useProject();
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resolvedFrameIndex = frameIndex ?? state.currentTimelineIndex;
  const [assets, setAssets] = useState<RenderSnapshotAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadRenderSnapshotAssets(state, resolvedFrameIndex)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setAssets(null);
          setError('Current frame is not available for preview.');
          return;
        }
        setAssets(loaded);
      })
      .catch((e) => {
        if (cancelled) return;
        setAssets(null);
        setError(e instanceof Error ? e.message : 'Preview failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state, resolvedFrameIndex]);

  const snapshot = useMemo(() => {
    if (!assets) return null;
    return buildRenderSnapshot(
      state,
      resolvedFrameIndex,
      assets,
      MAX_PREVIEW_DIMENSION,
      renderOptions,
    );
  }, [assets, state, resolvedFrameIndex, renderOptions]);

  useLayoutEffect(() => {
    if (!containerRef.current || !snapshot) {
      setFitScale(1);
      return;
    }
    const padding = 24;
    const availableW = Math.max(1, containerRef.current.clientWidth - padding);
    const availableH = Math.max(1, containerRef.current.clientHeight - padding);
    setFitScale(
      Math.min(availableW / snapshot.width, availableH / snapshot.height, 1),
    );
  }, [snapshot, renderOptions]);

  const frameLabel = state.timeline[resolvedFrameIndex]
    ? `Frame ${resolvedFrameIndex + 1}`
    : 'No frame';

  const stageKey = snapshot
    ? previewStageKey(renderOptions, `${snapshot.width}x${snapshot.height}`)
    : 'empty';

  return (
    <div className="flex h-full min-h-0 flex-col border border-border/60 bg-surface/40">
      <div className="border-b border-border/60 px-3 py-2">
        <p className="font-mono text-[9px] tracking-widest text-text-muted uppercase">
          Live preview
        </p>
        <p className="mt-0.5 font-mono text-[8px] text-text-muted/80">
          {frameLabel} · updates as you adjust settings
        </p>
      </div>
      <div
        ref={containerRef}
        className="relative flex min-h-[220px] flex-1 items-center justify-center overflow-hidden p-3"
      >
        {loading && (
          <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
            Loading preview…
          </p>
        )}
        {!loading && error && (
          <p className="px-3 text-center font-mono text-[10px] text-accent-crimson">{error}</p>
        )}
        {!loading && !error && snapshot && (
          <div
            className="overflow-hidden rounded border border-metal-shadow shadow-lg"
            style={{
              opacity: disabled ? 0.6 : 1,
              pointerEvents: 'none',
              width: snapshot.width * fitScale,
              height: snapshot.height * fitScale,
            }}
          >
            <div
              style={{
                transform: `scale(${fitScale})`,
                transformOrigin: 'top left',
                width: snapshot.width,
                height: snapshot.height,
              }}
            >
              <MapRenderStage
                key={stageKey}
                snapshot={snapshot}
                renderOptions={renderOptions}
                stageRef={stageRef}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
