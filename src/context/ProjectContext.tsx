import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as api from '../api/backend';
import { ApiError, apiHealth } from '../api/client';
import {
  DEFAULT_PALETTE,
  type FrameDuplicateOptions,
  type CityMarker,
  type DivisionMarker,
  type FrameInfo,
  type MarkerKind,
  type PaletteColor,
  type PolygonRing,
  type ProjectExport,
  type ProjectState,
  type ResolvedFrame,
  type ToolMode,
  DEFAULT_DIVISION_MARKER_SIZE,
} from '../types/project';
import type { ProjectDisplaySettings } from '../types/displaySettings';
import { DEFAULT_DISPLAY_SETTINGS } from '../types/displaySettings';
import { mergeServerProject, toProjectBody, type ProjectBody } from '../types/projectBody';
import { toIsoLocalDateTime } from '../utils/timelineDates';
import { getNextMapFilename } from '../utils/projectHelpers';
import {
  buildFileRegistry,
  initProjectFromFolder,
  reconcileFolderWithProject,
  revokeFileRegistry,
} from '../utils/reconcileFolder';
import { resolveCurrentFrame } from '../utils/projectHelpers';
import { stateToExport } from '../utils/exportSchema';
import { isEditableTarget } from '../utils/editableTarget';

const PROJECT_ID_KEY = 'prairiemap-project-id';
const MAX_UNDO_HISTORY = 50;

function cloneProjectBody(body: ReturnType<typeof toProjectBody>): ReturnType<typeof toProjectBody> {
  return structuredClone(body);
}

type UiAction =
  | { type: 'APPLY_SERVER'; body: ReturnType<typeof toProjectBody> }
  | { type: 'SET_FILE_REGISTRY'; registry: ProjectState['fileRegistry'] }
  | { type: 'MERGE_FOLDER'; patch: Pick<ProjectState, 'assets' | 'timeline' | 'fileRegistry' | 'projectName'> }
  | { type: 'SET_TOOL'; tool: ToolMode }
  | { type: 'SET_ACTIVE_COLOR'; colorId: string }
  | { type: 'TOGGLE_CARRY_LABELS' }
  | { type: 'SET_DISPLAY_SETTINGS'; displaySettings: ProjectDisplaySettings }
  | { type: 'SET_SELECTED_COUNTRY'; countryId: string | null }
  | {
      type: 'SET_SELECTED_MARKER';
      markerId: string | null;
      markerKind: MarkerKind | null;
    }
  | { type: 'SET_FILE_CANVAS_SIZE'; filename: string; width: number; height: number }
  | { type: 'ADD_PALETTE_COLOR'; color: PaletteColor }
  | { type: 'CLEAR_PROJECT' };

const initialState: ProjectState = {
  projectName: 'Untitled Campaign',
  assets: {},
  timeline: [],
  fileRegistry: {},
  currentTimelineIndex: 0,
  palette: DEFAULT_PALETTE,
  activeColorId: DEFAULT_PALETTE[0].id,
  tool: 'pan',
  carryOverLabels: true,
  displaySettings: DEFAULT_DISPLAY_SETTINGS,
  visitedTimelineIds: [],
  selectedCountryId: null,
  selectedMarkerId: null,
  selectedMarkerKind: null,
};

function uiReducer(state: ProjectState, action: UiAction): ProjectState {
  switch (action.type) {
    case 'APPLY_SERVER':
      return mergeServerProject(state, action.body);
    case 'SET_FILE_REGISTRY':
      return { ...state, fileRegistry: action.registry };
    case 'MERGE_FOLDER':
      return {
        ...state,
        projectName: action.patch.projectName,
        assets: action.patch.assets,
        timeline: action.patch.timeline,
        fileRegistry: action.patch.fileRegistry,
        currentTimelineIndex: Math.min(
          state.currentTimelineIndex,
          Math.max(0, action.patch.timeline.length - 1),
        ),
      };
    case 'SET_TOOL':
      return {
        ...state,
        tool: action.tool,
        selectedCountryId: action.tool === 'areaSelect' ? null : state.selectedCountryId,
      };
    case 'SET_ACTIVE_COLOR':
      return { ...state, activeColorId: action.colorId, selectedCountryId: null };
    case 'TOGGLE_CARRY_LABELS':
      return { ...state, carryOverLabels: !state.carryOverLabels };
    case 'SET_DISPLAY_SETTINGS':
      return { ...state, displaySettings: action.displaySettings };
    case 'SET_SELECTED_COUNTRY':
      return {
        ...state,
        selectedCountryId: action.countryId,
        selectedMarkerId: null,
        selectedMarkerKind: null,
      };
    case 'SET_SELECTED_MARKER':
      return {
        ...state,
        selectedMarkerId: action.markerId,
        selectedMarkerKind: action.markerKind,
        selectedCountryId: action.markerId ? null : state.selectedCountryId,
      };
    case 'SET_FILE_CANVAS_SIZE': {
      const entry = state.fileRegistry[action.filename];
      if (
        !entry ||
        (entry.canvasWidth === action.width && entry.canvasHeight === action.height)
      ) {
        return state;
      }
      return {
        ...state,
        fileRegistry: {
          ...state.fileRegistry,
          [action.filename]: {
            ...entry,
            canvasWidth: action.width,
            canvasHeight: action.height,
          },
        },
      };
    }
    case 'ADD_PALETTE_COLOR':
      return {
        ...state,
        palette: [...state.palette, action.color],
        activeColorId: action.color.id,
      };
    case 'CLEAR_PROJECT':
      return {
        ...initialState,
        palette: state.palette,
        activeColorId: state.activeColorId,
      };
    default:
      return state;
  }
}

interface ProjectContextValue {
  state: ProjectState;
  projectId: string | null;
  apiReady: boolean;
  apiError: string | null;
  isSyncing: boolean;
  currentFrame: ResolvedFrame | null;
  activeColor: PaletteColor | undefined;
  loadFolder: (files: FileList) => Promise<void>;
  setTimelineIndex: (index: number) => Promise<void>;
  reorderTimeline: (fromIndex: number, toIndex: number) => Promise<void>;
  deleteFrame: (index: number) => Promise<void>;
  nextFrame: () => Promise<void>;
  prevFrame: () => Promise<void>;
  setTool: (tool: ToolMode) => void;
  setActiveColor: (colorId: string) => void;
  toggleCarryLabels: () => void;
  updateDisplaySettings: (settings: ProjectDisplaySettings) => void;
  addTerritoryRegion: (region: PolygonRing) => Promise<void>;
  claimAnchor: (x: number, y: number) => Promise<void>;
  removeTerritoryVertex: (countryId: string, ringIndex: number, vertexIndex: number) => Promise<void>;
  moveTerritoryVertex: (
    countryId: string,
    ringIndex: number,
    vertexIndex: number,
    x: number,
    y: number,
  ) => Promise<void>;
  deleteCountry: (countryId: string) => Promise<void>;
  setSelectedCountry: (countryId: string | null) => void;
  setSelectedMarker: (markerId: string | null, kind: MarkerKind | null) => void;
  upsertMarkers: (cities: CityMarker[], divisions: DivisionMarker[]) => Promise<void>;
  addCityMarker: (x: number, y: number, name: string) => Promise<string | null>;
  updateCityMarker: (id: string, patch: Partial<Pick<CityMarker, 'x' | 'y' | 'name'>>) => Promise<void>;
  removeCityMarker: (id: string) => Promise<void>;
  addDivisionMarker: (x: number, y: number) => Promise<string | null>;
  updateDivisionMarker: (
    id: string,
    patch: Partial<Omit<DivisionMarker, 'id'>>,
  ) => Promise<void>;
  updateDivisionIcon: (
    id: string,
    patch: Partial<Pick<DivisionMarker, 'name' | 'sourceFilename' | 'crop' | 'size'>>,
    scope?: api.DivisionIconScope,
  ) => Promise<void>;
  divisionIconEditorId: string | null;
  setDivisionIconEditorId: (id: string | null) => void;
  removeDivisionMarker: (id: string) => Promise<void>;
  killDivisionMarker: (id: string) => Promise<void>;
  pasteTerritoryFromPreviousFrame: () => Promise<void>;
  canPasteTerritoryFromPrevious: boolean;
  copyMarkers: () => void;
  pasteMarkers: () => Promise<void>;
  hasMarkerClipboard: boolean;
  updateFrameInfo: (info: Partial<FrameInfo>) => Promise<void>;
  autoFillTimelineDates: (config: {
    startAt: Date;
    framesPerStep: number;
    minutesPerStep: number;
  }) => Promise<void>;
  addPaletteColor: (name: string, hex: string) => Promise<void>;
  updateFactionMetadata: (
    factionId: string,
    patch: { name?: string; hex?: string; flagFilename?: string | null },
  ) => Promise<void>;
  exportProject: () => ProjectExport;
  importProject: (data: ProjectExport, files: File[]) => Promise<void>;
  duplicateFrame: (sourceIndex: number, options: FrameDuplicateOptions) => Promise<boolean>;
  appendRecordedFrame: (sourceIndex: number, divisions: DivisionMarker[]) => Promise<number>;
  appendRecordedFramesBatch: (
    sourceIndex: number,
    divisionFrames: DivisionMarker[][],
  ) => Promise<number>;
  setFileCanvasSize: (filename: string, width: number, height: number) => void;
  saveToServer: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function currentTarget(frame: ResolvedFrame | null) {
  if (!frame) return null;
  return { filename: frame.filename, copyIndex: frame.copyIndex };
}

const MARKER_PASTE_OFFSET = 16;

type MarkerClipboard = { cities: CityMarker[]; divisions: DivisionMarker[] };

function cloneCityMarker(c: CityMarker): CityMarker {
  return { ...c };
}

function cloneDivisionMarker(d: DivisionMarker): DivisionMarker {
  return { ...d, crop: { ...d.crop } };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState);
  const [projectId, setProjectId] = useState<string | null>(() =>
    sessionStorage.getItem(PROJECT_ID_KEY),
  );
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Latest server project body; updated synchronously after each mutation. */
  const projectBodyRef = useRef<ProjectBody | null>(null);
  const undoStackRef = useRef<ReturnType<typeof toProjectBody>[]>([]);
  const redoStackRef = useRef<ReturnType<typeof toProjectBody>[]>([]);
  const restoringRef = useRef(false);
  const markerClipboardRef = useRef<MarkerClipboard | null>(null);
  const [hasMarkerClipboard, setHasMarkerClipboard] = useState(false);
  const [divisionIconEditorId, setDivisionIconEditorId] = useState<string | null>(null);

  const bumpHistory = useCallback(() => setHistoryTick((t) => t + 1), []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    bumpHistory();
  }, [bumpHistory]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  const applyMutation = useCallback((res: api.ProjectMutationResponse) => {
    dispatch({ type: 'APPLY_SERVER', body: res.project });
    projectBodyRef.current = cloneProjectBody(res.project);
    if (res.projectId) {
      setProjectId(res.projectId);
      sessionStorage.setItem(PROJECT_ID_KEY, res.projectId);
    }
  }, []);

  const projectBodyForMutation = useCallback(
    (): ProjectBody => projectBodyRef.current ?? toProjectBody(stateRef.current),
    [],
  );

  const restoreProjectBody = useCallback(
    async (body: ReturnType<typeof toProjectBody>) => {
      const id = projectId;
      if (!id) return;
      restoringRef.current = true;
      setIsSyncing(true);
      setApiError(null);
      try {
        const res = await api.saveProject(id, body);
        applyMutation(res);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'API error';
        setApiError(msg);
        throw e;
      } finally {
        restoringRef.current = false;
        setIsSyncing(false);
      }
    },
    [projectId, applyMutation],
  );

  const runMutation = useCallback(
    async (fn: () => Promise<api.ProjectMutationResponse>) => {
      const snapshot = restoringRef.current
        ? null
        : cloneProjectBody(toProjectBody(stateRef.current));
      setIsSyncing(true);
      setApiError(null);
      try {
        const res = await fn();
        if (snapshot) {
          undoStackRef.current.push(snapshot);
          if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
            undoStackRef.current.shift();
          }
          redoStackRef.current = [];
          bumpHistory();
        }
        applyMutation(res);
        return res;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'API error';
        setApiError(msg);
        throw e;
      } finally {
        setIsSyncing(false);
      }
    },
    [applyMutation, bumpHistory],
  );

  const undo = useCallback(async () => {
    if (undoStackRef.current.length === 0 || !projectId || isSyncing) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(cloneProjectBody(toProjectBody(stateRef.current)));
    bumpHistory();
    await restoreProjectBody(previous);
  }, [projectId, isSyncing, restoreProjectBody, bumpHistory]);

  const redo = useCallback(async () => {
    if (redoStackRef.current.length === 0 || !projectId || isSyncing) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(cloneProjectBody(toProjectBody(stateRef.current)));
    bumpHistory();
    await restoreProjectBody(next);
  }, [projectId, isSyncing, restoreProjectBody, bumpHistory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiHealth();
        if (cancelled) return;
        setApiReady(true);
        const storedId = sessionStorage.getItem(PROJECT_ID_KEY);
        if (storedId) {
          try {
            const body = await api.getProject(storedId);
            if (!cancelled) {
              dispatch({ type: 'APPLY_SERVER', body });
              clearHistory();
            }
            setProjectId(storedId);
            return;
          } catch {
            sessionStorage.removeItem(PROJECT_ID_KEY);
          }
        }
        const created = await api.createProject();
        if (!cancelled) {
          applyMutation(created);
          clearHistory();
        }
      } catch {
        if (!cancelled) {
          setApiError('Backend unavailable. Run: npm run dev:all');
          setApiReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyMutation, clearHistory]);

  const currentFrame = useMemo(() => resolveCurrentFrame(state), [state]);
  const activeColor = state.palette.find((c) => c.id === state.activeColorId);
  const canPasteTerritoryFromPrevious = state.currentTimelineIndex > 0;

  const knownFilenames = useCallback(
    () => Object.keys(stateRef.current.fileRegistry),
    [],
  );

  const loadFolder = useCallback(
    async (files: FileList) => {
      const fileArr = Array.from(files);
      revokeFileRegistry(stateRef.current.fileRegistry);
      const sorted = fileArr.filter((f) => f.type.startsWith('image/'));
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      );
      const filenames = sorted.map((f) => f.name);
      const registry = buildFileRegistry(sorted);

      if (stateRef.current.timeline.length === 0) {
        const init = initProjectFromFolder(fileArr);
        const res = await api.initFromFilenames(filenames);
        dispatch({
          type: 'MERGE_FOLDER',
          patch: {
            ...init,
            assets: res.project.assets,
            timeline: res.project.timeline,
            fileRegistry: registry,
          },
        });
        dispatch({ type: 'APPLY_SERVER', body: res.project });
        clearHistory();
      } else {
        const reconciled = reconcileFolderWithProject(fileArr, {
          assets: stateRef.current.assets,
          timeline: stateRef.current.timeline,
          projectName: stateRef.current.projectName,
          palette: stateRef.current.palette,
          carryOverLabels: stateRef.current.carryOverLabels,
        });
        const res = await api.reconcileFilenames(toProjectBody(stateRef.current), filenames);
        dispatch({
          type: 'MERGE_FOLDER',
          patch: {
            projectName: stateRef.current.projectName,
            assets: res.project.assets,
            timeline: res.project.timeline,
            fileRegistry: registry,
          },
        });
        dispatch({ type: 'APPLY_SERVER', body: res.project });
        clearHistory();
        void reconciled;
      }
    },
    [clearHistory],
  );

  const setTimelineIndex = useCallback(
    async (index: number) => {
      await runMutation(() =>
        api.setTimelineIndex(toProjectBody(stateRef.current), index),
      );
    },
    [runMutation],
  );

  const reorderTimeline = useCallback(
    async (fromIndex: number, toIndex: number) => {
      await runMutation(() =>
        api.reorderTimeline(toProjectBody(stateRef.current), fromIndex, toIndex),
      );
    },
    [runMutation],
  );

  const deleteFrame = useCallback(
    async (index: number) => {
      await runMutation(() =>
        api.deleteTimelineEntry(toProjectBody(stateRef.current), index),
      );
    },
    [runMutation],
  );

  const nextFrame = useCallback(async () => {
    await setTimelineIndex(stateRef.current.currentTimelineIndex + 1);
  }, [setTimelineIndex]);

  const prevFrame = useCallback(async () => {
    await setTimelineIndex(stateRef.current.currentTimelineIndex - 1);
  }, [setTimelineIndex]);

  const setTool = useCallback((tool: ToolMode) => {
    dispatch({ type: 'SET_TOOL', tool });
  }, []);

  const setActiveColor = useCallback((colorId: string) => {
    dispatch({ type: 'SET_ACTIVE_COLOR', colorId });
  }, []);

  const toggleCarryLabels = useCallback(() => {
    dispatch({ type: 'TOGGLE_CARRY_LABELS' });
  }, []);

  const updateDisplaySettings = useCallback((displaySettings: ProjectDisplaySettings) => {
    dispatch({ type: 'SET_DISPLAY_SETTINGS', displaySettings });
  }, []);

  const addTerritoryRegion = useCallback(
    async (region: PolygonRing) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      const faction = stateRef.current.palette.find(
        (c) => c.id === stateRef.current.activeColorId,
      );
      if (!faction) return;
      await runMutation(() =>
        api.addTerritoryRegion({
          project: toProjectBody(stateRef.current),
          target,
          factionId: faction.id,
          factionName: faction.name,
          color: faction.hex,
          region,
          targetCountryId: null,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const claimAnchor = useCallback(
    async (x: number, y: number) => {
      const target = currentTarget(currentFrame);
      const countryId = stateRef.current.selectedCountryId;
      if (!target || !countryId) return;
      await runMutation(() =>
        api.claimAnchor({
          project: toProjectBody(stateRef.current),
          target,
          countryId,
          x,
          y,
          epsilon: 2,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const removeTerritoryVertex = useCallback(
    async (countryId: string, ringIndex: number, vertexIndex: number) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      await runMutation(() =>
        api.removeTerritoryVertex({
          project: toProjectBody(stateRef.current),
          target,
          countryId,
          ringIndex,
          vertexIndex,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const moveTerritoryVertex = useCallback(
    async (
      countryId: string,
      ringIndex: number,
      vertexIndex: number,
      x: number,
      y: number,
    ) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      await runMutation(() =>
        api.moveTerritoryVertex({
          project: toProjectBody(stateRef.current),
          target,
          countryId,
          ringIndex,
          vertexIndex,
          x,
          y,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const deleteCountry = useCallback(
    async (countryId: string) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      await runMutation(() =>
        api.deleteCountry({
          project: toProjectBody(stateRef.current),
          target,
          countryId,
        }),
      );
      if (stateRef.current.selectedCountryId === countryId) {
        dispatch({ type: 'SET_SELECTED_COUNTRY', countryId: null });
      }
    },
    [currentFrame, runMutation],
  );

  const setSelectedCountry = useCallback((countryId: string | null) => {
    dispatch({ type: 'SET_SELECTED_COUNTRY', countryId });
  }, []);

  const setSelectedMarker = useCallback((markerId: string | null, kind: MarkerKind | null) => {
    dispatch({ type: 'SET_SELECTED_MARKER', markerId, markerKind: kind });
  }, []);

  const upsertMarkers = useCallback(
    async (cities: CityMarker[], divisions: DivisionMarker[]) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      await runMutation(() =>
        api.upsertMarkers({
          project: toProjectBody(stateRef.current),
          target,
          cities,
          divisions,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const addCityMarker = useCallback(
    async (x: number, y: number, name: string) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return null;
      const id = uuidv4();
      const cities = [
        ...frame.frameData.annotations.cities,
        { id, x, y, name: name.trim() || 'City' },
      ];
      await upsertMarkers(cities, frame.frameData.annotations.divisions);
      setSelectedMarker(id, 'city');
      return id;
    },
    [upsertMarkers, setSelectedMarker],
  );

  const updateCityMarker = useCallback(
    async (id: string, patch: Partial<Pick<CityMarker, 'x' | 'y' | 'name'>>) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      const cities = frame.frameData.annotations.cities.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      );
      await upsertMarkers(cities, frame.frameData.annotations.divisions);
    },
    [upsertMarkers],
  );

  const removeCityMarker = useCallback(
    async (id: string) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      const cities = frame.frameData.annotations.cities.filter((c) => c.id !== id);
      await upsertMarkers(cities, frame.frameData.annotations.divisions);
      if (stateRef.current.selectedMarkerId === id) {
        setSelectedMarker(null, null);
      }
    },
    [upsertMarkers, setSelectedMarker],
  );

  const addDivisionMarker = useCallback(
    async (x: number, y: number) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return null;
      const filenames = Object.keys(stateRef.current.assets).filter(
        (f) => !f.startsWith('__blank__/'),
      );
      const sourceFilename = filenames[0] ?? '';
      const id = uuidv4();
      const divisions = [
        ...frame.frameData.annotations.divisions,
        {
          id,
          name: 'Division',
          x,
          y,
          size: DEFAULT_DIVISION_MARKER_SIZE,
          sourceFilename,
          crop: { x: 0, y: 0, width: 64, height: 64 },
        },
      ];
      await upsertMarkers(frame.frameData.annotations.cities, divisions);
      setSelectedMarker(id, 'division');
      return id;
    },
    [upsertMarkers, setSelectedMarker],
  );

  const updateDivisionMarker = useCallback(
    async (id: string, patch: Partial<Omit<DivisionMarker, 'id'>>) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      const divisions = frame.frameData.annotations.divisions.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          ...patch,
          crop: patch.crop ? { ...d.crop, ...patch.crop } : d.crop,
        };
      });
      await upsertMarkers(frame.frameData.annotations.cities, divisions);
    },
    [upsertMarkers],
  );

  const updateDivisionIcon = useCallback(
    async (
      id: string,
      patch: Partial<Pick<DivisionMarker, 'name' | 'sourceFilename' | 'crop' | 'size'>>,
      scope: api.DivisionIconScope = 'all_frames',
    ) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      await runMutation(() =>
        api.updateDivisionIcon({
          project: projectBodyForMutation(),
          divisionId: id,
          patch,
          scope,
          target:
            scope === 'current_frame'
              ? { filename: frame.filename, copyIndex: frame.copyIndex }
              : undefined,
        }),
      );
    },
    [projectBodyForMutation, runMutation],
  );

  const removeDivisionMarker = useCallback(
    async (id: string) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      await runMutation(() =>
        api.removeDivision({
          project: projectBodyForMutation(),
          divisionId: id,
          scope: 'current_frame',
          target: { filename: frame.filename, copyIndex: frame.copyIndex },
        }),
      );
      if (stateRef.current.selectedMarkerId === id) {
        setSelectedMarker(null, null);
      }
    },
    [projectBodyForMutation, runMutation, setSelectedMarker],
  );

  const killDivisionMarker = useCallback(
    async (id: string) => {
      const frame = resolveCurrentFrame(stateRef.current);
      if (!frame) return;
      await runMutation(() =>
        api.removeDivision({
          project: projectBodyForMutation(),
          divisionId: id,
          scope: 'current_and_future',
          fromTimelineIndex: stateRef.current.currentTimelineIndex,
        }),
      );
      if (stateRef.current.selectedMarkerId === id) {
        setSelectedMarker(null, null);
      }
    },
    [projectBodyForMutation, runMutation, setSelectedMarker],
  );

  const pasteTerritoryFromPreviousFrame = useCallback(async () => {
    const s = stateRef.current;
    const frame = resolveCurrentFrame(s);
    const sourceIndex = s.currentTimelineIndex - 1;
    if (!frame || sourceIndex < 0) return;
    await runMutation(() =>
      api.pasteTerritory({
        project: projectBodyForMutation(),
        target: { filename: frame.filename, copyIndex: frame.copyIndex },
        sourceTimelineIndex: sourceIndex,
      }),
    );
    setSelectedCountry(null);
  }, [projectBodyForMutation, runMutation, setSelectedCountry]);

  const copyMarkers = useCallback(() => {
    const frame = resolveCurrentFrame(stateRef.current);
    if (!frame) return;
    const { selectedMarkerId, selectedMarkerKind } = stateRef.current;
    const ann = frame.frameData.annotations;
    if (selectedMarkerId && selectedMarkerKind === 'city') {
      const city = ann.cities.find((c) => c.id === selectedMarkerId);
      markerClipboardRef.current = {
        cities: city ? [cloneCityMarker(city)] : [],
        divisions: [],
      };
    } else if (selectedMarkerId && selectedMarkerKind === 'division') {
      const division = ann.divisions.find((d) => d.id === selectedMarkerId);
      markerClipboardRef.current = {
        cities: [],
        divisions: division ? [cloneDivisionMarker(division)] : [],
      };
    } else {
      markerClipboardRef.current = {
        cities: ann.cities.map(cloneCityMarker),
        divisions: ann.divisions.map(cloneDivisionMarker),
      };
    }
    const clip = markerClipboardRef.current;
    setHasMarkerClipboard(
      (clip?.cities.length ?? 0) > 0 || (clip?.divisions.length ?? 0) > 0,
    );
  }, []);

  const pasteMarkers = useCallback(async () => {
    const clip = markerClipboardRef.current;
    if (!clip || (clip.cities.length === 0 && clip.divisions.length === 0)) return;
    const frame = resolveCurrentFrame(stateRef.current);
    if (!frame) return;
    const pastedCities = clip.cities.map((c) => ({
      ...cloneCityMarker(c),
      id: uuidv4(),
      x: c.x + MARKER_PASTE_OFFSET,
      y: c.y + MARKER_PASTE_OFFSET,
    }));
    const pastedDivisions = clip.divisions.map((d) => ({
      ...cloneDivisionMarker(d),
      id: uuidv4(),
      x: d.x + MARKER_PASTE_OFFSET,
      y: d.y + MARKER_PASTE_OFFSET,
    }));
    await upsertMarkers(
      [...frame.frameData.annotations.cities, ...pastedCities],
      [...frame.frameData.annotations.divisions, ...pastedDivisions],
    );
    if (pastedCities.length > 0) {
      setSelectedMarker(pastedCities[0].id, 'city');
    } else if (pastedDivisions.length > 0) {
      setSelectedMarker(pastedDivisions[0].id, 'division');
    }
  }, [upsertMarkers, setSelectedMarker]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void undo();
        return;
      }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        void redo();
        return;
      }
      if (e.key === 'c') {
        e.preventDefault();
        copyMarkers();
        return;
      }
      if (e.key === 'v') {
        e.preventDefault();
        void pasteMarkers();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, copyMarkers, pasteMarkers]);

  const updateFrameInfo = useCallback(
    async (info: Partial<FrameInfo>) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      await runMutation(() =>
        api.updateFrameInfo({
          project: toProjectBody(stateRef.current),
          target,
          dateTitle: info.dateTitle,
          description: info.description,
          factionStats: info.factionStats,
        }),
      );
    },
    [currentFrame, runMutation],
  );

  const autoFillTimelineDates = useCallback(
    async (config: { startAt: Date; framesPerStep: number; minutesPerStep: number }) => {
      if (stateRef.current.timeline.length === 0) return;
      await runMutation(() =>
        api.autoFillTimelineDates({
          project: projectBodyForMutation(),
          startAt: toIsoLocalDateTime(config.startAt),
          framesPerStep: config.framesPerStep,
          minutesPerStep: config.minutesPerStep,
        }),
      );
    },
    [projectBodyForMutation, runMutation],
  );

  const addPaletteColor = useCallback(
    async (name: string, hex: string) => {
      const prevIds = new Set(stateRef.current.palette.map((p) => p.id));
      await runMutation(() =>
        api.addPaletteColor({
          project: toProjectBody(stateRef.current),
          name,
          hex,
        }),
      );
      const added = stateRef.current.palette.find((p) => !prevIds.has(p.id));
      if (added) {
        dispatch({ type: 'SET_ACTIVE_COLOR', colorId: added.id });
        if (stateRef.current.tool === 'pan') {
          dispatch({ type: 'SET_TOOL', tool: 'areaSelect' });
        }
      }
    },
    [runMutation],
  );

  const updateFactionMetadata = useCallback(
    async (factionId: string, patch: { name?: string; hex?: string; flagFilename?: string | null }) => {
      const setFlag = patch.flagFilename !== undefined;
      await runMutation(() =>
        api.updateFactionMetadata({
          project: toProjectBody(stateRef.current),
          factionId,
          name: patch.name,
          hex: patch.hex,
          ...(setFlag ? { flagFilename: patch.flagFilename, setFlag: true } : {}),
        }),
      );
    },
    [runMutation],
  );

  const exportProject = useCallback((): ProjectExport => {
    return stateToExport(stateRef.current);
  }, []);

  const importProject = useCallback(
    async (data: ProjectExport, files: File[]) => {
      revokeFileRegistry(stateRef.current.fileRegistry);
      const res = await api.importProject(data);
      const sorted = Array.from(files).filter((f) => f.type.startsWith('image/'));
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      );
      const registry = buildFileRegistry(sorted);
      const filenames = sorted.map((f) => f.name);
      const reconciled = await api.reconcileFilenames(res.project, filenames);
      applyMutation(reconciled);
      clearHistory();
      if (reconciled.projectId) {
        setProjectId(reconciled.projectId);
        sessionStorage.setItem(PROJECT_ID_KEY, reconciled.projectId);
      }
      dispatch({
        type: 'MERGE_FOLDER',
        patch: {
          projectName: reconciled.project.projectName,
          assets: reconciled.project.assets,
          timeline: reconciled.project.timeline,
          fileRegistry: registry,
        },
      });
    },
    [applyMutation, clearHistory],
  );

  const duplicateFrame = useCallback(
    async (sourceIndex: number, options: FrameDuplicateOptions): Promise<boolean> => {
      if (!options.duplicateMapImage) {
        const nextMap = getNextMapFilename(
          stateRef.current.timeline,
          stateRef.current.fileRegistry,
          sourceIndex,
        );
        if (!nextMap) return false;
      }
      try {
        await runMutation(() =>
          api.duplicateFrame({
            project: toProjectBody(stateRef.current),
            sourceIndex,
            options,
            knownFilenames: knownFilenames(),
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
    [runMutation, knownFilenames],
  );

  const appendRecordedFrame = useCallback(
    async (sourceIndex: number, divisions: DivisionMarker[]): Promise<number> => {
      const res = await runMutation(() =>
        api.appendRecordedFrame({
          project: projectBodyForMutation(),
          sourceIndex,
          divisions,
          knownFilenames: knownFilenames(),
        }),
      );
      return res.project.currentTimelineIndex;
    },
    [runMutation, knownFilenames, projectBodyForMutation],
  );

  const appendRecordedFramesBatch = useCallback(
    async (sourceIndex: number, divisionFrames: DivisionMarker[][]): Promise<number> => {
      if (divisionFrames.length === 0) {
        return sourceIndex;
      }
      const res = await runMutation(async () => {
        let project = projectBodyForMutation();
        let index = sourceIndex;
        let last: api.ProjectMutationResponse | undefined;
        for (const divisions of divisionFrames) {
          last = await api.appendRecordedFrame({
            project,
            sourceIndex: index,
            divisions,
            knownFilenames: knownFilenames(),
          });
          project = last.project;
          index = last.project.currentTimelineIndex;
        }
        return last!;
      });
      return res.project.currentTimelineIndex;
    },
    [runMutation, knownFilenames, projectBodyForMutation],
  );

  const setFileCanvasSize = useCallback((filename: string, width: number, height: number) => {
    dispatch({ type: 'SET_FILE_CANVAS_SIZE', filename, width, height });
  }, []);

  const saveToServer = useCallback(async () => {
    if (!projectId) return;
    setIsSyncing(true);
    try {
      await api.saveProject(projectId, toProjectBody(stateRef.current));
    } finally {
      setIsSyncing(false);
    }
  }, [projectId]);

  const value = useMemo<ProjectContextValue>(
    () => ({
      state,
      projectId,
      apiReady,
      apiError,
      isSyncing,
      currentFrame,
      activeColor,
      loadFolder,
      setTimelineIndex,
      reorderTimeline,
      deleteFrame,
      nextFrame,
      prevFrame,
      setTool,
      setActiveColor,
      toggleCarryLabels,
      updateDisplaySettings,
      addTerritoryRegion,
      claimAnchor,
      removeTerritoryVertex,
      moveTerritoryVertex,
      deleteCountry,
      setSelectedCountry,
      setSelectedMarker,
      upsertMarkers,
      addCityMarker,
      updateCityMarker,
      removeCityMarker,
      addDivisionMarker,
      updateDivisionMarker,
      updateDivisionIcon,
      divisionIconEditorId,
      setDivisionIconEditorId,
      removeDivisionMarker,
      killDivisionMarker,
      pasteTerritoryFromPreviousFrame,
      canPasteTerritoryFromPrevious,
      copyMarkers,
      pasteMarkers,
      hasMarkerClipboard,
      updateFrameInfo,
      autoFillTimelineDates,
      addPaletteColor,
      updateFactionMetadata,
      exportProject,
      importProject,
      duplicateFrame,
      appendRecordedFrame,
      appendRecordedFramesBatch,
      setFileCanvasSize,
      saveToServer,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      state,
      projectId,
      apiReady,
      apiError,
      isSyncing,
      currentFrame,
      activeColor,
      loadFolder,
      setTimelineIndex,
      reorderTimeline,
      deleteFrame,
      nextFrame,
      prevFrame,
      setTool,
      setActiveColor,
      toggleCarryLabels,
      updateDisplaySettings,
      addTerritoryRegion,
      claimAnchor,
      removeTerritoryVertex,
      moveTerritoryVertex,
      deleteCountry,
      setSelectedCountry,
      setSelectedMarker,
      upsertMarkers,
      addCityMarker,
      updateCityMarker,
      removeCityMarker,
      addDivisionMarker,
      updateDivisionMarker,
      updateDivisionIcon,
      divisionIconEditorId,
      setDivisionIconEditorId,
      removeDivisionMarker,
      killDivisionMarker,
      pasteTerritoryFromPreviousFrame,
      canPasteTerritoryFromPrevious,
      copyMarkers,
      pasteMarkers,
      hasMarkerClipboard,
      updateFrameInfo,
      autoFillTimelineDates,
      addPaletteColor,
      updateFactionMetadata,
      exportProject,
      importProject,
      duplicateFrame,
      appendRecordedFrame,
      appendRecordedFramesBatch,
      setFileCanvasSize,
      saveToServer,
      undo,
      redo,
      canUndo,
      canRedo,
      historyTick,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
