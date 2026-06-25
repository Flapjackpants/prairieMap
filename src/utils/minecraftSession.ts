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

export async function applyRecordingSessionToTimeline(
  session: MinecraftRecordingSession,
  sourceTimelineIndex: number,
  appendRecordedFrame: (sourceIndex: number, divisions: DivisionMarker[]) => Promise<number>,
): Promise<number> {
  const transform = getSessionTransform(session);
  let index = sourceTimelineIndex;
  for (const snapshot of session.snapshots) {
    const divisions = playersToDivisions(
      Object.values(snapshot.players),
      session.anchorWorld,
      transform,
      session.divisionTemplate,
    );
    index = await appendRecordedFrame(index, divisions);
  }
  return index;
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
