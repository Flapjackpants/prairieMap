import { describe, expect, it, vi } from 'vitest';
import type { MinecraftRecordingSession } from '../types/minecraft';
import type { DivisionMarker } from '../types/project';
import {
  applyRecordingSessionToTimeline,
  buildRecordingSession,
  parseRecordingSession,
  selectSnapshotsAtRate,
  playersToDivisions,
} from './minecraftSession';
import { buildTransform } from './minecraftTransform';

const sampleSession: MinecraftRecordingSession = {
  version: 1,
  recordedAt: '2026-06-24T12:00:00.000Z',
  apiTarget: 'localhost',
  apiPort: 8080,
  anchorUuid: 'player-1',
  anchorWorld: 'overworld',
  calibrationA: { gameX: 0, gameZ: 0, mapX: 100, mapY: 200 },
  calibrationB: { gameX: 100, gameZ: 0, mapX: 200, mapY: 200 },
  divisionTemplate: {
    sourceFilename: 'icons.png',
    crop: { x: 0, y: 0, width: 64, height: 64 },
    size: 28,
  },
  sourceTimelineIndex: 0,
  sourceFilename: 'map.png',
  snapshots: [
    {
      timestamp: 1,
      players: {
        'player-1': {
          uuid: 'player-1',
          name: 'Steve',
          world: 'overworld',
          x: 50,
          y: 64,
          z: 10,
          yaw: 0,
          facing: 'south',
          armor: { head: null, chest: null, legs: null, feet: null },
          timestamp: 1,
        },
      },
    },
  ],
};

describe('parseRecordingSession', () => {
  it('parses a valid session', () => {
    const parsed = parseRecordingSession(sampleSession);
    expect(parsed.snapshots).toHaveLength(1);
    expect(parsed.calibrationA.gameX).toBe(0);
  });

  it('rejects invalid version', () => {
    expect(() => parseRecordingSession({ ...sampleSession, version: 99 })).toThrow(
      /Unsupported recording version/,
    );
  });
});

describe('playersToDivisions', () => {
  it('maps players in anchor world to division markers', () => {
    const transform = buildTransform(sampleSession.calibrationA, sampleSession.calibrationB);
    const divisions = playersToDivisions(
      Object.values(sampleSession.snapshots[0]!.players),
      'overworld',
      transform,
      sampleSession.divisionTemplate,
    );
    expect(divisions).toHaveLength(1);
    expect(divisions[0]!.name).toBe('Steve');
    expect(divisions[0]!.id).toBe('player-1');
  });
});

describe('selectSnapshotsAtRate', () => {
  const makeSnapshots = (count: number, stepSec = 1) =>
    Array.from({ length: count }, (_, i) => ({
      timestamp: i * stepSec,
      players: sampleSession.snapshots[0]!.players,
    }));

  it('keeps every snapshot at 1 fps for 1Hz capture', () => {
    const snaps = makeSnapshots(10);
    const selected = selectSnapshotsAtRate(snaps, 1);
    expect(selected.length).toBeGreaterThanOrEqual(9);
    expect(selected.length).toBeLessThanOrEqual(11);
  });

  it('subsamples at 0.1 fps', () => {
    const snaps = makeSnapshots(30);
    const selected = selectSnapshotsAtRate(snaps, 0.1);
    expect(selected.length).toBeGreaterThanOrEqual(2);
    expect(selected.length).toBeLessThanOrEqual(5);
  });

  it('rejects invalid frame rate', () => {
    expect(() => selectSnapshotsAtRate(makeSnapshots(5), 0)).toThrow(/positive/);
  });
});

describe('applyRecordingSessionToTimeline', () => {
  it('appends one frame per snapshot at 1 fps', async () => {
    const appendBatch = vi.fn(async (_idx: number, frames: DivisionMarker[][]) => frames.length);
    const finalIndex = await applyRecordingSessionToTimeline(sampleSession, 0, appendBatch);
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(appendBatch).toHaveBeenCalledWith(0, expect.any(Array));
    expect(finalIndex).toBe(1);
  });
});

describe('buildRecordingSession', () => {
  it('wraps snapshots with metadata', () => {
    const session = buildRecordingSession(
      {
        recordedAt: sampleSession.recordedAt,
        apiTarget: sampleSession.apiTarget,
        apiPort: sampleSession.apiPort,
        anchorUuid: sampleSession.anchorUuid,
        anchorWorld: sampleSession.anchorWorld,
        calibrationA: sampleSession.calibrationA,
        calibrationB: sampleSession.calibrationB,
        divisionTemplate: sampleSession.divisionTemplate,
        sourceTimelineIndex: 0,
        sourceFilename: 'map.png',
      },
      sampleSession.snapshots,
    );
    expect(session.version).toBe(1);
    expect(session.snapshots).toHaveLength(1);
  });
});
