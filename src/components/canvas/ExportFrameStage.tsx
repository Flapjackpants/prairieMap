import type Konva from 'konva';
import type { MapRenderSnapshot } from './MapRenderStage';
import { MapRenderStage } from './MapRenderStage';
import { videoExportRenderOptions } from '../../types/renderOptions';

export type ExportFrameSnapshot = MapRenderSnapshot;

interface ExportFrameStageProps {
  snapshot: ExportFrameSnapshot | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export function ExportFrameStage({ snapshot, stageRef }: ExportFrameStageProps) {
  if (!snapshot) return null;

  return (
    <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0" aria-hidden>
      <MapRenderStage
        snapshot={snapshot}
        renderOptions={videoExportRenderOptions(snapshot.displaySettings)}
        stageRef={stageRef}
      />
    </div>
  );
}
