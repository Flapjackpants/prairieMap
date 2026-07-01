import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  buildRecordStreamUrl,
  checkHealth,
  fetchPlayer,
  fetchPlayers,
  snapshotsToPlayerList,
} from '../api/minecraft';
import { ApiError } from '../api/client';
import { useProject } from './ProjectContext';
import type {
  CalibrationPair,
  DivisionTemplate,
  MinecraftApiTarget,
  MinecraftRecordingSession,
  PlayerSnapshot,
  ServerSnapshot,
} from '../types/minecraft';
import { MINECRAFT_API_TARGETS, resolveMinecraftBaseUrl } from '../types/minecraft';
import { DEFAULT_DIVISION_MARKER_SIZE, isBlankAssetKey } from '../types/project';
import { buildTransform, gameToMap } from '../utils/minecraftTransform';
import {
  applyRecordingSessionToTimeline,
  buildRecordingSession,
  downloadRecordingSession,
  getSessionTransform,
  mergeSessionForImport,
  parseRecordingSession,
  playersToDivisions,
  selectSnapshotsAtRate,
  worldsMatch,
  type RecordingImportOptions,
} from '../utils/minecraftSession';

const POLL_INTERVAL_MS = 1000;
const SSE_CONNECT_TIMEOUT_MS = 4000;

export type MinecraftWizardStep = 'connect' | 'calibrate' | 'record';

export type CalibrationPhase =
  | 'needGameA'
  | 'needMapA'
  | 'needGameB'
  | 'needMapB'
  | 'ready';

export type RecordingTransport = 'idle' | 'sse' | 'poll';

export type RecordingImportMode = RecordingImportOptions['mode'];

function getCalibrationPhase(
  a: Partial<CalibrationPair>,
  b: Partial<CalibrationPair>,
  awaiting: 'A' | 'B' | null,
): CalibrationPhase {
  const hasGameA = a.gameX !== undefined && a.gameZ !== undefined;
  const hasMapA = a.mapX !== undefined && a.mapY !== undefined;
  const hasGameB = b.gameX !== undefined && b.gameZ !== undefined;
  const hasMapB = b.mapX !== undefined && b.mapY !== undefined;

  if (!hasGameA) return 'needGameA';
  if (!hasMapA || awaiting === 'A') return 'needMapA';
  if (!hasGameB) return 'needGameB';
  if (!hasMapB || awaiting === 'B') return 'needMapB';
  return 'ready';
}

export interface MinecraftRecordingContextValue {
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  step: MinecraftWizardStep;
  setStep: (step: MinecraftWizardStep) => void;
  apiTarget: MinecraftApiTarget;
  setApiTarget: (target: MinecraftApiTarget) => void;
  apiPort: number;
  setApiPort: (port: number) => void;
  baseUrl: string;
  connectionOk: boolean;
  connectionError: string | null;
  isTestingConnection: boolean;
  testConnection: () => Promise<void>;
  players: PlayerSnapshot[];
  anchorUuid: string;
  onAnchorChange: (uuid: string) => void;
  anchorWorld: string;
  calibrationA: Partial<CalibrationPair>;
  calibrationB: Partial<CalibrationPair>;
  calibrationPhase: CalibrationPhase;
  awaitingMapClick: 'A' | 'B' | null;
  captureGamePosition: (which: 'A' | 'B') => Promise<void>;
  runCalibrationAction: () => void;
  resetCalibration: () => void;
  cancelMapPick: () => void;
  setMapPoint: (which: 'A' | 'B', mapX: number, mapY: number) => void;
  calibrationComplete: boolean;
  /** Live anchor player projected onto the map (verify calibration before recording). */
  anchorMapPreview: { x: number; y: number } | null;
  refreshAnchorMapPreview: () => Promise<void>;
  divisionTemplate: DivisionTemplate;
  setDivisionTemplate: React.Dispatch<React.SetStateAction<DivisionTemplate>>;
  isRecording: boolean;
  recordingTransport: RecordingTransport;
  streamEnded: boolean;
  framesRecorded: number;
  lastSnapshotTime: number | null;
  lastPlayerCount: number;
  recordingError: string | null;
  capturedSession: MinecraftRecordingSession | null;
  loadedRecording: MinecraftRecordingSession | null;
  startRecording: () => void;
  stopRecording: () => void;
  resetRecordingStats: () => void;
  downloadCapturedSession: () => void;
  loadRecordingFile: (file: File) => Promise<void>;
  clearLoadedRecording: () => void;
  applyLoadedRecording: (options: RecordingImportOptions) => Promise<void>;
  isImporting: boolean;
  importError: string | null;
  apiReady: boolean;
  hasCurrentFrame: boolean;
}

const MinecraftRecordingContext = createContext<MinecraftRecordingContextValue | null>(null);

export function MinecraftRecordingProvider({ children }: { children: ReactNode }) {
  const {
    apiReady,
    state,
    currentFrame,
    appendRecordedFramesBatch,
    upsertMarkers,
  } = useProject();

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<MinecraftWizardStep>('connect');
  const [apiTarget, setApiTargetState] = useState<MinecraftApiTarget>('localhost');
  const [apiPort, setApiPortState] = useState(8080);
  const [connectionOk, setConnectionOk] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [players, setPlayers] = useState<PlayerSnapshot[]>([]);
  const [anchorUuid, setAnchorUuid] = useState('');
  const [anchorWorld, setAnchorWorld] = useState('');

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
  const [recordingTransport, setRecordingTransport] = useState<RecordingTransport>('idle');
  const [streamEnded, setStreamEnded] = useState(false);
  const [framesRecorded, setFramesRecorded] = useState(0);
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number | null>(null);
  const [lastPlayerCount, setLastPlayerCount] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [capturedSession, setCapturedSession] = useState<MinecraftRecordingSession | null>(null);
  const [loadedRecording, setLoadedRecording] = useState<MinecraftRecordingSession | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [anchorMapPreview, setAnchorMapPreview] = useState<{ x: number; y: number } | null>(null);

  const capturedSnapshotsRef = useRef<ServerSnapshot[]>([]);
  const recordingActiveRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const sseGotMessageRef = useRef(false);
  const sseConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const snapshotQueueRef = useRef<string[]>([]);

  const baseUrl = resolveMinecraftBaseUrl(apiTarget, apiPort);

  const calibrationComplete =
    calibrationA.gameX !== undefined &&
    calibrationA.gameZ !== undefined &&
    calibrationA.mapX !== undefined &&
    calibrationA.mapY !== undefined &&
    calibrationB.gameX !== undefined &&
    calibrationB.gameZ !== undefined &&
    calibrationB.mapX !== undefined &&
    calibrationB.mapY !== undefined;

  const calibrationPhase = getCalibrationPhase(calibrationA, calibrationB, awaitingMapClick);

  const refreshAnchorMapPreview = useCallback(async () => {
    if (!calibrationComplete || !anchorUuid) {
      setAnchorMapPreview(null);
      return;
    }
    try {
      const player = await fetchPlayer(baseUrl, anchorUuid);
      const transform = buildTransform(
        calibrationA as CalibrationPair,
        calibrationB as CalibrationPair,
      );
      setAnchorMapPreview(gameToMap(transform, player.x, player.z));
      setRecordingError(null);
    } catch (e) {
      setAnchorMapPreview(null);
      setRecordingError(e instanceof Error ? e.message : 'Failed to preview anchor on map');
    }
  }, [anchorUuid, baseUrl, calibrationA, calibrationB, calibrationComplete]);

  useEffect(() => {
    if (!calibrationComplete || !modalOpen) {
      setAnchorMapPreview(null);
      return;
    }
    void refreshAnchorMapPreview();
    const id = setInterval(() => void refreshAnchorMapPreview(), 2000);
    return () => clearInterval(id);
  }, [calibrationComplete, modalOpen, refreshAnchorMapPreview]);

  const clearPollInterval = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const clearSse = useCallback(() => {
    if (sseConnectTimerRef.current) {
      clearTimeout(sseConnectTimerRef.current);
      sseConnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const finalizeCapturedSession = useCallback(() => {
    if (capturedSnapshotsRef.current.length === 0) return;
    if (!calibrationComplete) return;

    const session = buildRecordingSession(
      {
        recordedAt: new Date().toISOString(),
        apiTarget,
        apiPort,
        anchorUuid,
        anchorWorld,
        calibrationA: calibrationA as CalibrationPair,
        calibrationB: calibrationB as CalibrationPair,
        divisionTemplate: { ...divisionTemplate, crop: { ...divisionTemplate.crop } },
        sourceTimelineIndex: state.currentTimelineIndex,
        sourceFilename: currentFrame?.filename ?? '',
      },
      [...capturedSnapshotsRef.current],
    );
    setCapturedSession(session);
    downloadRecordingSession(session);
  }, [
    apiPort,
    apiTarget,
    anchorUuid,
    anchorWorld,
    calibrationA,
    calibrationB,
    calibrationComplete,
    currentFrame?.filename,
    divisionTemplate,
    state.currentTimelineIndex,
  ]);

  const ingestSnapshot = useCallback(
    (snapshot: ServerSnapshot) => {
      capturedSnapshotsRef.current.push(snapshot);
      const playerList = Object.values(snapshot.players).filter((p) =>
        worldsMatch(p.world, anchorWorld),
      );
      setFramesRecorded(capturedSnapshotsRef.current.length);
      setLastSnapshotTime(snapshot.timestamp);
      setLastPlayerCount(playerList.length);
    },
    [anchorWorld],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (snapshotQueueRef.current.length > 0) {
      const raw = snapshotQueueRef.current.shift();
      if (!raw) continue;
      try {
        const snapshot = JSON.parse(raw) as ServerSnapshot;
        ingestSnapshot(snapshot);
      } catch (e) {
        setRecordingError(e instanceof Error ? e.message : 'Failed to capture snapshot');
        snapshotQueueRef.current = [];
        break;
      }
    }
    processingRef.current = false;
  }, [ingestSnapshot]);

  const stopRecording = useCallback(() => {
    recordingActiveRef.current = false;
    clearSse();
    clearPollInterval();
    setIsRecording(false);
    setRecordingTransport('idle');
    setStreamEnded(true);
    void processQueue().then(() => finalizeCapturedSession());
  }, [clearPollInterval, clearSse, finalizeCapturedSession, processQueue]);

  const startPolling = useCallback(() => {
    if (!recordingActiveRef.current) return;
    clearSse();
    clearPollInterval();
    setRecordingTransport('poll');
    setIsRecording(true);
    setRecordingError(null);

    const tick = async () => {
      if (!recordingActiveRef.current || pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const snapshot = await fetchPlayers(baseUrl);
        ingestSnapshot(snapshot);
        setRecordingError(null);
      } catch (e) {
        setRecordingError(e instanceof Error ? e.message : 'Poll failed');
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void tick();
    pollIntervalRef.current = setInterval(() => void tick(), POLL_INTERVAL_MS);
  }, [baseUrl, clearPollInterval, clearSse, ingestSnapshot]);

  const startSse = useCallback(() => {
    if (!recordingActiveRef.current) return;
    clearSse();
    sseGotMessageRef.current = false;
    setRecordingTransport('sse');
    setIsRecording(true);
    setRecordingError(null);

    const es = new EventSource(buildRecordStreamUrl(baseUrl));
    eventSourceRef.current = es;

    sseConnectTimerRef.current = setTimeout(() => {
      if (!recordingActiveRef.current) return;
      if (!sseGotMessageRef.current && eventSourceRef.current === es) {
        es.close();
        eventSourceRef.current = null;
        startPolling();
      }
    }, SSE_CONNECT_TIMEOUT_MS);

    es.onmessage = (event) => {
      if (!recordingActiveRef.current) return;
      sseGotMessageRef.current = true;
      if (sseConnectTimerRef.current) {
        clearTimeout(sseConnectTimerRef.current);
        sseConnectTimerRef.current = null;
      }
      snapshotQueueRef.current.push(event.data);
      void processQueue();
    };

    es.onerror = () => {
      if (sseConnectTimerRef.current) {
        clearTimeout(sseConnectTimerRef.current);
        sseConnectTimerRef.current = null;
      }
      es.close();
      if (eventSourceRef.current === es) eventSourceRef.current = null;

      if (!recordingActiveRef.current) return;

      // SSE unavailable or server closed the stream — keep capturing via poll.
      startPolling();
    };
  }, [baseUrl, clearSse, processQueue, startPolling]);

  const startRecording = useCallback(() => {
    setRecordingError(null);
    setCapturedSession(null);
    setImportError(null);

    if (!apiReady) {
      setRecordingError('Start the PrairieMap API server (npm run dev:api).');
      return;
    }
    if (!calibrationComplete) {
      setRecordingError(
        'Finish calibration: capture in-game X/Z and click the matching map point for both A and B.',
      );
      return;
    }

    try {
      buildTransform(calibrationA as CalibrationPair, calibrationB as CalibrationPair);
    } catch (e) {
      setRecordingError(e instanceof Error ? e.message : 'Invalid calibration');
      return;
    }

    clearSse();
    clearPollInterval();
    recordingActiveRef.current = true;
    capturedSnapshotsRef.current = [];
    setStreamEnded(false);
    setFramesRecorded(0);
    setLastSnapshotTime(null);
    setLastPlayerCount(0);
    snapshotQueueRef.current = [];

    startSse();
  }, [apiReady, calibrationA, calibrationB, calibrationComplete, clearPollInterval, clearSse, startSse]);

  const resetRecordingStats = useCallback(() => {
    setStreamEnded(false);
    setFramesRecorded(0);
    setLastSnapshotTime(null);
    setLastPlayerCount(0);
    setRecordingError(null);
    setCapturedSession(null);
    capturedSnapshotsRef.current = [];
  }, []);

  const downloadCapturedSession = useCallback(() => {
    if (!capturedSession) return;
    downloadRecordingSession(capturedSession);
  }, [capturedSession]);

  const loadRecordingFile = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const session = parseRecordingSession(JSON.parse(text) as unknown);
      setLoadedRecording(session);
      // Keep the Calibrate step the user just finished — only pull calibration from the file
      // when the UI has no complete calibration yet.
      if (!calibrationComplete) {
        setCalibrationA(session.calibrationA);
        setCalibrationB(session.calibrationB);
        setAnchorUuid(session.anchorUuid);
        setAnchorWorld(session.anchorWorld);
      }
      setStep('record');
    } catch (e) {
      setLoadedRecording(null);
      setImportError(e instanceof Error ? e.message : 'Invalid recording file');
      throw e;
    }
  }, [calibrationComplete]);

  const clearLoadedRecording = useCallback(() => {
    setLoadedRecording(null);
    setImportError(null);
  }, []);

  const applyLoadedRecording = useCallback(
    async (options: RecordingImportOptions) => {
      setImportError(null);
      if (!loadedRecording) {
        setImportError('Choose a recording JSON file first.');
        return;
      }
      if (!apiReady) {
        setImportError('Start the PrairieMap API server (npm run dev:api).');
        return;
      }
      if (!currentFrame) {
        setImportError('Load a map frame before applying a recording.');
        return;
      }
      if (!Number.isFinite(options.framesPerSecond) || options.framesPerSecond <= 0) {
        setImportError('Frame rate must be a positive number (e.g. 1 or 0.1).');
        return;
      }

      setIsImporting(true);
      try {
        const sessionForImport = mergeSessionForImport(
          loadedRecording,
          calibrationComplete
            ? {
                calibrationA: calibrationA as CalibrationPair,
                calibrationB: calibrationB as CalibrationPair,
                anchorWorld,
                anchorUuid,
              }
            : undefined,
        );

        if (options.mode === 'timeline') {
          await applyRecordingSessionToTimeline(
            sessionForImport,
            state.currentTimelineIndex,
            appendRecordedFramesBatch,
            options.framesPerSecond,
          );
        } else {
          const selected = selectSnapshotsAtRate(
            sessionForImport.snapshots,
            options.framesPerSecond,
          );
          const snapshot = selected[selected.length - 1]!;
          const transform = getSessionTransform(sessionForImport);
          const divisions = playersToDivisions(
            Object.values(snapshot.players),
            sessionForImport.anchorWorld,
            transform,
            sessionForImport.divisionTemplate,
          );
          await upsertMarkers(currentFrame.frameData.annotations.cities, divisions);
        }
        setCapturedSession(loadedRecording);
        setImportError(null);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : 'Import failed');
        throw e;
      } finally {
        setIsImporting(false);
      }
    },
    [
      apiReady,
      appendRecordedFramesBatch,
      anchorWorld,
      anchorUuid,
      calibrationA,
      calibrationB,
      calibrationComplete,
      currentFrame,
      loadedRecording,
      state.currentTimelineIndex,
      upsertMarkers,
    ],
  );

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => {
    if (isRecording) return;
    setModalOpen(false);
    setAwaitingMapClick(null);
  }, [isRecording]);

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

  const testConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionError(null);
    setConnectionOk(false);
    try {
      const health = await checkHealth(baseUrl);
      if (health.status !== 'ok') throw new Error('Unexpected health response');
      const snapshot = await fetchPlayers(baseUrl);
      const list = snapshotsToPlayerList(snapshot);
      setPlayers(list);
      setConnectionOk(true);
      if (list.length > 0) {
        setAnchorUuid((prev) => prev || list[0].uuid);
        setAnchorWorld((prev) => prev || list[0].world);
      }
      setStep('calibrate');
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Connection failed';
      const steps = MINECRAFT_API_TARGETS[apiTarget].helpSteps.join(' ');
      setConnectionError(
        msg.includes('connect') || msg.includes('reachable')
          ? `${msg} Nothing is listening at ${baseUrl}/api/health. ${steps}`
          : msg,
      );
    } finally {
      setIsTestingConnection(false);
    }
  }, [apiTarget, baseUrl]);

  const captureGamePosition = useCallback(
    async (which: 'A' | 'B') => {
      if (!anchorUuid) {
        setRecordingError('Select your player first.');
        return;
      }
      setRecordingError(null);
      try {
        const player = await fetchPlayer(baseUrl, anchorUuid);
        const gameX = Number(player.x);
        const gameZ = Number(player.z);
        if (!Number.isFinite(gameX) || !Number.isFinite(gameZ)) {
          throw new Error('Player position from API is not numeric');
        }
        const pair = { gameX, gameZ };
        if (which === 'A') {
          setCalibrationA((prev) => ({ ...prev, ...pair, mapX: undefined, mapY: undefined }));
        } else {
          setCalibrationB((prev) => ({ ...prev, ...pair, mapX: undefined, mapY: undefined }));
        }
        setAnchorWorld(player.world);
        setAwaitingMapClick(which);
      } catch (e) {
        setRecordingError(e instanceof Error ? e.message : 'Failed to capture position');
      }
    },
    [anchorUuid, baseUrl],
  );

  const setMapPoint = useCallback((which: 'A' | 'B', mapX: number, mapY: number) => {
    if (which === 'A') {
      setCalibrationA((prev) => ({ ...prev, mapX, mapY }));
    } else {
      setCalibrationB((prev) => ({ ...prev, mapX, mapY }));
      setStep('record');
    }
    setAwaitingMapClick(null);
    setRecordingError(null);
    if (which === 'B') {
      void refreshAnchorMapPreview();
    }
  }, [refreshAnchorMapPreview]);

  const resetCalibration = useCallback(() => {
    setCalibrationA({});
    setCalibrationB({});
    setAwaitingMapClick(null);
    setRecordingError(null);
    setAnchorMapPreview(null);
  }, []);

  const cancelMapPick = useCallback(() => {
    setAwaitingMapClick(null);
    setRecordingError(null);
  }, []);

  const runCalibrationAction = useCallback(() => {
    switch (calibrationPhase) {
      case 'needGameA':
        void captureGamePosition('A');
        break;
      case 'needMapA':
        setRecordingError(null);
        setAwaitingMapClick('A');
        break;
      case 'needGameB':
        void captureGamePosition('B');
        break;
      case 'needMapB':
        setRecordingError(null);
        setAwaitingMapClick('B');
        break;
      case 'ready':
        setStep('record');
        break;
    }
  }, [calibrationPhase, captureGamePosition]);

  useEffect(() => {
    return () => {
      clearSse();
      clearPollInterval();
    };
  }, [clearPollInterval, clearSse]);

  const onAnchorChange = useCallback(
    (uuid: string) => {
      setAnchorUuid(uuid);
      const player = players.find((p) => p.uuid === uuid);
      if (player) setAnchorWorld(player.world);
    },
    [players],
  );

  const value: MinecraftRecordingContextValue = {
    modalOpen,
    openModal,
    closeModal,
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
    calibrationPhase,
    awaitingMapClick,
    captureGamePosition,
    runCalibrationAction,
    resetCalibration,
    cancelMapPick,
    setMapPoint,
    calibrationComplete,
    anchorMapPreview,
    refreshAnchorMapPreview,
    divisionTemplate,
    setDivisionTemplate,
    isRecording,
    recordingTransport,
    streamEnded,
    framesRecorded,
    lastSnapshotTime,
    lastPlayerCount,
    recordingError,
    capturedSession,
    loadedRecording,
    startRecording,
    stopRecording,
    resetRecordingStats,
    downloadCapturedSession,
    loadRecordingFile,
    clearLoadedRecording,
    applyLoadedRecording,
    isImporting,
    importError,
    apiReady,
    hasCurrentFrame: Boolean(currentFrame),
  };

  return (
    <MinecraftRecordingContext.Provider value={value}>{children}</MinecraftRecordingContext.Provider>
  );
}

export function useMinecraftRecording() {
  const ctx = useContext(MinecraftRecordingContext);
  if (!ctx) {
    throw new Error('useMinecraftRecording must be used within MinecraftRecordingProvider');
  }
  return ctx;
}

export function useMinecraftRecordingOptional() {
  return useContext(MinecraftRecordingContext);
}
