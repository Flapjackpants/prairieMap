import type Konva from 'konva';
import type { MapRenderSnapshot } from './MapRenderStage';
import { MapRenderStage } from './MapRenderStage';
import type { FrameRenderOptions } from '../../types/renderOptions';

export type ExportFrameSnapshot = MapRenderSnapshot;

interface ExportFrameStageProps {
  snapshot: ExportFrameSnapshot | null;
  renderOptions: FrameRenderOptions | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export function ExportFrameStage({ snapshot, renderOptions, stageRef }: ExportFrameStageProps) {
  if (!snapshot || !renderOptions) return null;

  return (
    <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0" aria-hidden>
      <MapRenderStage snapshot={snapshot} renderOptions={renderOptions} stageRef={stageRef} />
    </div>
  );
}
