import { v4 as uuidv4 } from 'uuid';
import type {
  AssetFrameState,
  DrawStroke,
  FactionStat,
  FrameAnnotations,
  FrameInfo,
  MapLabel,
  StrokePoint,
} from '../types/project';

function clonePoint(p: StrokePoint): StrokePoint {
  return { x: p.x, y: p.y };
}

function cloneStroke(stroke: DrawStroke): DrawStroke {
  return {
    id: uuidv4(),
    color: stroke.color,
    size: stroke.size,
    opacity: stroke.opacity,
    points: stroke.points.map(clonePoint),
  };
}

function cloneLabel(label: MapLabel): MapLabel {
  return {
    id: uuidv4(),
    x: label.x,
    y: label.y,
    text: label.text,
    fontSize: label.fontSize,
    color: label.color,
    ...(label.width !== undefined ? { width: label.width } : {}),
  };
}

function cloneFactionStat(stat: FactionStat): FactionStat {
  return {
    id: uuidv4(),
    factionId: stat.factionId,
    metric: stat.metric,
    value: stat.value,
  };
}

/** Deep-clone annotations with new IDs so edits never alias the source frame. */
export function cloneAnnotations(source: FrameAnnotations): FrameAnnotations {
  return {
    strokes: source.strokes.map(cloneStroke),
    labels: source.labels.map(cloneLabel),
  };
}

/** Deep-clone info board data with new stat IDs. */
export function cloneFrameInfo(source: FrameInfo): FrameInfo {
  return {
    dateTitle: source.dateTitle,
    description: source.description,
    factionStats: source.factionStats.map(cloneFactionStat),
  };
}

export function cloneAssetState(source: AssetFrameState): AssetFrameState {
  return {
    annotations: cloneAnnotations(source.annotations),
    info: cloneFrameInfo(source.info),
  };
}
