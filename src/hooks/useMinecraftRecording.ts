import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildRecordStreamUrl,
  checkHealth,
  fetchPlayer,
  fetchPlayers,
  snapshotsToPlayerList,
} from '../api/minecraft';
import { ApiError } from '../api/client';
import { useProject } from '../context/ProjectContext';
import type {
  CalibrationPair,
  DivisionTemplate,
  MinecraftApiTarget,
  PlayerSnapshot,
} from '../types/minecraft';
import { resolveMinecraftBaseUrl, MINECRAFT_API_TARGETS } from '../types/minecraft';
import type { DivisionMarker } from '../types/project';
import { DEFAULT_DIVISION_MARKER_SIZE, isBlankAssetKey } from '../types/project';
import { buildTransform, gameToMap, type SimilarityTransform } from '../utils/minecraftTransform';

const MAX_STREAM_FRAMES = 30;

export type MinecraftWizardStep =
  | 'connect'
  | 'anchor'
  | 'calibrateA'
  | 'calibrateB'
  | 'settings'
  | 'record';

function playersToDivisions(
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

export function useMinecraftRecording() {
  const {
    apiReady,
    state,
    currentFrame,
    appendRecordedFrame,
    setMapClickHandler,
  } = useProject();

  const [step, setStep] = useState<MinecraftWizardStep>('connect');
  const [apiTarget, setApiTargetState] = useState<MinecraftApiTarget>('localhost');
  const [apiPort, setApiPortState] = useState(8080);
  const [connectionOk, setConnectionOk] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [players, setPlayers] = useState<PlayerSnapshot[]>([]);
  const [anchorUuid, setAnchorUuid] = useState<string>('');
  const [anchorWorld, setAnchorWorld] = useState<string>('');

  const [calibrationA, setCalibrationA] = useState<Partial<CalibrationPair>>({});
  const [calibrationB, setCalibrationB] = useState<Partial<CalibrationPair>>({});
  const [awaitingMapClick, setAwaitingMapClick] = useState<'A' | 'B' | null>(null);

  const [divisionTemplate, setDivisionTemplate] = useState<DivisionTemplate>(() => {
    const filenames = Object.keys(state.assets).filter((f) => !isBlankAssetKey(f));
    return {
      sourceFilename: filenames[0] ?? '',
      crop: { x: 0, y: 0, width: 64, height: 64 },
      size: DEFAULT_DIVISION_MARKER_SIZE,
    };
  });

  const [isRecording, setIsRecording] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);
  const [framesRecorded, setFramesRecorded] = useState(0);
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number | null>(null);
  const [lastPlayerCount, setLastPlayerCount] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const transformRef = useRef<SimilarityTransform | null>(null);
  const sourceFrameIndexRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const processingRef = useRef(false);
  const snapshotQueueRef = useRef<string[]>([]);

  const baseUrl = resolveMinecraftBaseUrl(apiTarget, apiPort);

  const setApiTarget = useCallback((target: MinecraftApiTarget) => {
    setApiTargetState(target);
    setConnectionOk(false);
    setConnectionError(null);
    setPlayers([]);
  }, []);

  const setApiPort = useCallback((port: number) => {
    const safe = Number.isFinite(port) && port > 0 && port <= 65535 ? Math.round(port) : 8080;
    setApiPortState(safe);
    setConnectionOk(false);
    setConnectionError(null);
    setPlayers([]);
  }, []);

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setStreamEnded(false);
    setFramesRecorded(0);
    setLastSnapshotTime(null);
    setLastPlayerCount(0);
    setRecordingError(null);
    snapshotQueueRef.current = [];
    processingRef.current = false;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setMapClickHandler(null);
    };
  }, [setMapClickHandler]);

  const testConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionError(null);
    setConnectionOk(false);
    try {
      const health = await checkHealth(baseUrl);
      if (health.status !== 'ok') {
        throw new Error('Unexpected health response');
      }
      const snapshot = await fetchPlayers(baseUrl);
      const list = snapshotsToPlayerList(snapshot);
      setPlayers(list);
      setConnectionOk(true);
      if (list.length > 0 && !anchorUuid) {
        setAnchorUuid(list[0].uuid);
        setAnchorWorld(list[0].world);
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Connection failed';
      const steps = MINECRAFT_API_TARGETS[apiTarget].helpSteps.join(' ');
      setConnectionError(
        msg.includes('connect') || msg.includes('reachable')
          ? `${msg} Nothing is listening at ${baseUrl}/api/health. ${steps}`
          : msg,
      );
      setConnectionOk(false);
    } finally {
      setIsTestingConnection(false);
    }
  }, [anchorUuid, apiTarget, baseUrl, apiPort]);

  const captureGamePosition = useCallback(
    async (which: 'A' | 'B') => {
      if (!anchorUuid) return;
      setRecordingError(null);
      try {
        const player = await fetchPlayer(baseUrl, anchorUuid);
        const pair = { gameX: player.x, gameZ: player.z };
        if (which === 'A') {
          setCalibrationA((prev) => ({ ...prev, ...pair }));
        } else {
          setCalibrationB((prev) => ({ ...prev, ...pair }));
        }
        setAnchorWorld(player.world);
        setAwaitingMapClick(which);
      } catch (e) {
        setRecordingError(e instanceof Error ? e.message : 'Failed to capture position');
      }
    },
    [anchorUuid, baseUrl],
  );

  useEffect(() => {
    if (!awaitingMapClick) return;
    setMapClickHandler((x, y) => {
      if (awaitingMapClick === 'A') {
        setCalibrationA((prev) => ({ ...prev, mapX: x, mapY: y }));
        setStep('calibrateB');
      } else {
        setCalibrationB((prev) => ({ ...prev, mapX: x, mapY: y }));
        setStep('settings');
      }
      setAwaitingMapClick(null);
      setMapClickHandler(null);
    });
    return () => setMapClickHandler(null);
  }, [awaitingMapClick, setMapClickHandler]);

  const calibrationComplete =
    calibrationA.gameX !== undefined &&
    calibrationA.gameZ !== undefined &&
    calibrationA.mapX !== undefined &&
    calibrationA.mapY !== undefined &&
    calibrationB.gameX !== undefined &&
    calibrationB.gameZ !== undefined &&
    calibrationB.mapX !== undefined &&
    calibrationB.mapY !== undefined;

  const buildTransformFromCalibration = useCallback(() => {
    if (!calibrationComplete) return null;
    try {
      return buildTransform(
        calibrationA as CalibrationPair,
        calibrationB as CalibrationPair,
      );
    } catch (e) {
      setRecordingError(e instanceof Error ? e.message : 'Invalid calibration');
      return null;
    }
  }, [calibrationA, calibrationB, calibrationComplete]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    const transform = transformRef.current;
    const world = anchorWorld;
    const template = divisionTemplate;

    while (snapshotQueueRef.current.length > 0) {
      const raw = snapshotQueueRef.current.shift();
      if (!raw || !transform) continue;
      try {
        const snapshot = JSON.parse(raw) as { timestamp: number; players: Record<string, PlayerSnapshot> };
        const playerList = Object.values(snapshot.players);
        const divisions = playersToDivisions(playerList, world, transform, template);
        const newIndex = await appendRecordedFrame(sourceFrameIndexRef.current, divisions);
        sourceFrameIndexRef.current = newIndex;
        setFramesRecorded((n) => n + 1);
        setLastSnapshotTime(snapshot.timestamp);
        setLastPlayerCount(divisions.length);
      } catch (e) {
        setRecordingError(e instanceof Error ? e.message : 'Failed to append frame');
        snapshotQueueRef.current = [];
        break;
      }
    }
    processingRef.current = false;
  }, [anchorWorld, appendRecordedFrame, divisionTemplate]);

  const startRecording = useCallback(() => {
    if (!apiReady || !currentFrame) {
      setRecordingError('Load a map frame and ensure the API server is running.');
      return;
    }
    const transform = buildTransformFromCalibration();
    if (!transform) return;

    resetRecordingState();
    transformRef.current = transform;
    sourceFrameIndexRef.current = state.currentTimelineIndex;
    setIsRecording(true);
    setStreamEnded(false);
    setRecordingError(null);

    const es = new EventSource(buildRecordStreamUrl(baseUrl));
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      snapshotQueueRef.current.push(event.data);
      void processQueue();
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setIsRecording(false);
      setStreamEnded(true);
      void processQueue();
    };
  }, [
    apiReady,
    baseUrl,
    buildTransformFromCalibration,
    currentFrame,
    processQueue,
    resetRecordingState,
    state.currentTimelineIndex,
  ]);

  const stopRecording = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRecording(false);
    void processQueue();
  }, [processQueue]);

  const onAnchorChange = useCallback(
    (uuid: string) => {
      setAnchorUuid(uuid);
      const player = players.find((p) => p.uuid === uuid);
      if (player) setAnchorWorld(player.world);
    },
    [players],
  );

  return {
    step,
    setStep,
    apiTarget,
    setApiTarget,
    apiPort,
    setApiPort,
    baseUrl,
    connectionOk,
    connectionError,
    isTestingConnection,
    testConnection,
    players,
    anchorUuid,
    onAnchorChange,
    anchorWorld,
    calibrationA,
    calibrationB,
    awaitingMapClick,
    captureGamePosition,
    calibrationComplete,
    divisionTemplate,
    setDivisionTemplate,
    isRecording,
    streamEnded,
    framesRecorded,
    maxStreamFrames: MAX_STREAM_FRAMES,
    lastSnapshotTime,
    lastPlayerCount,
    recordingError,
    startRecording,
    stopRecording,
    resetRecordingState,
    apiReady,
    hasCurrentFrame: Boolean(currentFrame),
  };
}
