import type {
  CalibrationPair,
  DivisionTemplate,
  MinecraftRecordingSession,
  PlayerSnapshot,
  ServerSnapshot,
} from '../types/minecraft';
import { MINECRAFT_RECORDING_SESSION_VERSION } from '../types/minecraft';
import type { DivisionMarker, CityMarker } from '../types/project';
import { buildTransform, gameToMap, type SimilarityTransform } from './minecraftTransform';

export function playersToDivisions(
  players: PlayerSnapshot[],
  anchorWorld: string,
  transform: SimilarityTransform,
  template: DivisionTemplate,
): DivisionMarker[] {
  return players
    .filter((p) => p.world === anchorWorld)
    .map((p) => {
      const { x, y } = gameToMap(transform, p.x, p.z);
      return {
        id: p.uuid,
        name: p.name,
        x,
        y,
        size: template.size,
        sourceFilename: template.sourceFilename,
        crop: { ...template.crop },
      };
    });
}

export function buildRecordingSession(
  meta: Omit<MinecraftRecordingSession, 'version' | 'snapshots'>,
  snapshots: ServerSnapshot[],
): MinecraftRecordingSession {
  return {
    version: MINECRAFT_RECORDING_SESSION_VERSION,
    ...meta,
    snapshots,
  };
}

export function downloadRecordingSession(session: MinecraftRecordingSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = session.recordedAt.replace(/[:.]/g, '-');
  a.download = `prairiemap-mc-recording-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isCalibrationPair(value: unknown): value is CalibrationPair {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.gameX === 'number' &&
    typeof v.gameZ === 'number' &&
    typeof v.mapX === 'number' &&
    typeof v.mapY === 'number'
  );
}

function isServerSnapshot(value: unknown): value is ServerSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.timestamp === 'number' && v.players !== null && typeof v.players === 'object';
}

export function parseRecordingSession(raw: unknown): MinecraftRecordingSession {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Recording file must be a JSON object');
  }
  const data = raw as Record<string, unknown>;
  if (data.version !== MINECRAFT_RECORDING_SESSION_VERSION) {
    throw new Error(`Unsupported recording version: ${String(data.version)}`);
  }
  if (!isCalibrationPair(data.calibrationA) || !isCalibrationPair(data.calibrationB)) {
    throw new Error('Recording file is missing valid calibration points');
  }
  if (!Array.isArray(data.snapshots) || data.snapshots.length === 0) {
    throw new Error('Recording file has no snapshots');
  }
  if (!data.snapshots.every(isServerSnapshot)) {
    throw new Error('Recording file contains invalid snapshot data');
  }
  if (typeof data.recordedAt !== 'string') {
    throw new Error('Recording file is missing recordedAt');
  }
  if (data.apiTarget !== 'localhost' && data.apiTarget !== 'prairie') {
    throw new Error('Recording file has invalid apiTarget');
  }
  if (typeof data.apiPort !== 'number') {
    throw new Error('Recording file is missing apiPort');
  }
  if (typeof data.anchorUuid !== 'string' || typeof data.anchorWorld !== 'string') {
    throw new Error('Recording file is missing anchor player info');
  }
  if (!data.divisionTemplate || typeof data.divisionTemplate !== 'object') {
    throw new Error('Recording file is missing divisionTemplate');
  }

  return {
    version: MINECRAFT_RECORDING_SESSION_VERSION,
    recordedAt: data.recordedAt as string,
    apiTarget: data.apiTarget as MinecraftRecordingSession['apiTarget'],
    apiPort: data.apiPort as number,
    anchorUuid: data.anchorUuid as string,
    anchorWorld: data.anchorWorld as string,
    calibrationA: data.calibrationA as CalibrationPair,
    calibrationB: data.calibrationB as CalibrationPair,
    divisionTemplate: data.divisionTemplate as DivisionTemplate,
    sourceTimelineIndex: typeof data.sourceTimelineIndex === 'number' ? data.sourceTimelineIndex : 0,
    sourceFilename: typeof data.sourceFilename === 'string' ? data.sourceFilename : '',
    snapshots: data.snapshots as ServerSnapshot[],
  };
}

export function getSessionTransform(session: MinecraftRecordingSession): SimilarityTransform {
  return buildTransform(session.calibrationA, session.calibrationB);
}

/** Normalize snapshot timestamps to milliseconds relative to the first sample. */
export function snapshotTimesMs(snapshots: ServerSnapshot[]): number[] {
  if (snapshots.length === 0) return [];
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const t0 = sorted[0]!.timestamp;
  const relative = sorted.map((s) => s.timestamp - t0);
  const span = relative[relative.length - 1] ?? 0;
  const scale = span > 0 && span < sorted.length * 2 ? 1000 : 1;
  return relative.map((t) => t * scale);
}

export function sortSnapshots(snapshots: ServerSnapshot[]): ServerSnapshot[] {
  return [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Pick snapshots spaced at the given output rate (frames per second).
 * e.g. 1 fps → one frame per second of recording; 0.1 fps → one every 10 seconds.
 */
export function selectSnapshotsAtRate(
  snapshots: ServerSnapshot[],
  framesPerSecond: number,
): ServerSnapshot[] {
  if (!Number.isFinite(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error('Frame rate must be a positive number');
  }
  const sorted = sortSnapshots(snapshots);
  if (sorted.length <= 1) return sorted;

  const timesMs = snapshotTimesMs(sorted);
  const durationMs = timesMs[timesMs.length - 1] ?? 0;
  const intervalMs = 1000 / framesPerSecond;

  if (durationMs <= 0 || intervalMs <= 0) {
    return [sorted[0]!];
  }

  const selected: ServerSnapshot[] = [];
  let snapIdx = 0;

  for (let t = 0; t <= durationMs; t += intervalMs) {
    while (snapIdx + 1 < sorted.length && timesMs[snapIdx + 1]! <= t) {
      snapIdx += 1;
    }
    const snap = sorted[snapIdx]!;
    if (selected.length === 0 || selected[selected.length - 1] !== snap) {
      selected.push(snap);
    }
  }

  const last = sorted[sorted.length - 1]!;
  if (selected[selected.length - 1] !== last) {
    selected.push(last);
  }

  return selected;
}

export function recordingDurationMs(snapshots: ServerSnapshot[]): number {
  const times = snapshotTimesMs(snapshots);
  return times[times.length - 1] ?? 0;
}

export interface RecordingImportOptions {
  mode: 'timeline' | 'current-frame';
  /** Output timeline frames per second of recording time (e.g. 1, 0.1). */
  framesPerSecond: number;
}

export async function applyRecordingSessionToTimeline(
  session: MinecraftRecordingSession,
  sourceTimelineIndex: number,
  appendFramesBatch: (
    sourceIndex: number,
    divisionFrames: DivisionMarker[][],
  ) => Promise<number>,
  framesPerSecond = 1,
): Promise<number> {
  const transform = getSessionTransform(session);
  const snapshots = selectSnapshotsAtRate(session.snapshots, framesPerSecond);
  const divisionFrames = snapshots.map((snapshot) =>
    playersToDivisions(
      Object.values(snapshot.players),
      session.anchorWorld,
      transform,
      session.divisionTemplate,
    ),
  );
  return appendFramesBatch(sourceTimelineIndex, divisionFrames);
}

export async function applyRecordingSnapshotToFrame(
  session: MinecraftRecordingSession,
  snapshotIndex: number,
  cities: CityMarker[],
  upsertMarkers: (cities: CityMarker[], divisions: DivisionMarker[]) => Promise<void>,
): Promise<void> {
  if (snapshotIndex < 0 || snapshotIndex >= session.snapshots.length) {
    throw new Error('Snapshot index out of range');
  }
  const transform = getSessionTransform(session);
  const snapshot = session.snapshots[snapshotIndex]!;
  const divisions = playersToDivisions(
    Object.values(snapshot.players),
    session.anchorWorld,
    transform,
    session.divisionTemplate,
  );
  await upsertMarkers(cities, divisions);
}
