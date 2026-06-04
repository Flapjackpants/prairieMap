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
  type FrameInfo,
  type PaletteColor,
  type PolygonRing,
  type ProjectExport,
  type ProjectState,
  type ResolvedFrame,
  type TerritoryDrawMode,
  type ToolMode,
  type ViewportState,
} from '../types/project';
import { mergeServerProject, toProjectBody } from '../types/projectBody';
import { getNextMapFilename } from '../utils/projectHelpers';
import {
  buildFileRegistry,
  initProjectFromFolder,
  reconcileFolderWithProject,
  revokeFileRegistry,
} from '../utils/reconcileFolder';
import { resolveCurrentFrame } from '../utils/projectHelpers';
import { stateToExport } from '../utils/exportSchema';

const PROJECT_ID_KEY = 'prairiemap-project-id';
const MAX_UNDO_HISTORY = 50;

function cloneProjectBody(body: ReturnType<typeof toProjectBody>): ReturnType<typeof toProjectBody> {
  return structuredClone(body);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

type UiAction =
  | { type: 'APPLY_SERVER'; body: ReturnType<typeof toProjectBody> }
  | { type: 'SET_FILE_REGISTRY'; registry: ProjectState['fileRegistry'] }
  | { type: 'MERGE_FOLDER'; patch: Pick<ProjectState, 'assets' | 'timeline' | 'fileRegistry' | 'projectName'> }
  | { type: 'SET_TOOL'; tool: ToolMode }
  | { type: 'SET_ACTIVE_COLOR'; colorId: string }
  | { type: 'TOGGLE_CARRY_LABELS' }
  | { type: 'SET_VIEWPORT'; viewport: ViewportState }
  | { type: 'SET_SELECTED_COUNTRY'; countryId: string | null }
  | { type: 'SET_TERRITORY_DRAW_MODE'; mode: TerritoryDrawMode }
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
  viewport: { scale: 1, x: 0, y: 0 },
  selectedCountryId: null,
  territoryDrawMode: 'primary',
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
      return { ...state, tool: action.tool };
    case 'SET_ACTIVE_COLOR':
      return { ...state, activeColorId: action.colorId };
    case 'TOGGLE_CARRY_LABELS':
      return { ...state, carryOverLabels: !state.carryOverLabels };
    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_SELECTED_COUNTRY':
      return {
        ...state,
        selectedCountryId: action.countryId,
        territoryDrawMode: action.countryId ? state.territoryDrawMode : 'primary',
      };
    case 'SET_TERRITORY_DRAW_MODE':
      return { ...state, territoryDrawMode: action.mode };
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
  setViewport: (viewport: ViewportState) => void;
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
  setTerritoryDrawMode: (mode: TerritoryDrawMode) => void;
  updateFrameInfo: (info: Partial<FrameInfo>) => Promise<void>;
  addPaletteColor: (name: string, hex: string) => void;
  updateFactionMetadata: (factionId: string, patch: { name?: string; hex?: string }) => Promise<void>;
  exportProject: () => ProjectExport;
  importProject: (data: ProjectExport, files: File[]) => Promise<void>;
  duplicateFrame: (sourceIndex: number, options: FrameDuplicateOptions) => Promise<boolean>;
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
  const undoStackRef = useRef<ReturnType<typeof toProjectBody>[]>([]);
  const redoStackRef = useRef<ReturnType<typeof toProjectBody>[]>([]);
  const restoringRef = useRef(false);

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
    if (res.projectId) {
      setProjectId(res.projectId);
      sessionStorage.setItem(PROJECT_ID_KEY, res.projectId);
    }
  }, []);

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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

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
          setApiError('Backend unavailable. Start API: cd backend && uvicorn app.main:app --reload');
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
      dispatch({ type: 'SET_VIEWPORT', viewport: { scale: 1, x: 0, y: 0 } });
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
      dispatch({ type: 'SET_VIEWPORT', viewport: { scale: 1, x: 0, y: 0 } });
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

  const setViewport = useCallback((viewport: ViewportState) => {
    dispatch({ type: 'SET_VIEWPORT', viewport });
  }, []);

  const addTerritoryRegion = useCallback(
    async (region: PolygonRing) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      const frame = resolveCurrentFrame(stateRef.current);
      const selectedId = stateRef.current.selectedCountryId;
      const selectedCountry = selectedId
        ? frame?.frameData.annotations.countries.find((c) => c.id === selectedId)
        : undefined;
      const paletteFaction = activeColor;
      if (!selectedCountry && !paletteFaction) return;
      const factionId = selectedCountry?.factionId ?? paletteFaction!.id;
      const factionName = selectedCountry?.name ?? paletteFaction!.name;
      const color = selectedCountry?.color ?? paletteFaction!.hex;
      const extend =
        stateRef.current.territoryDrawMode === 'extend' && Boolean(selectedId);
      await runMutation(() =>
        api.addTerritoryRegion({
          project: toProjectBody(stateRef.current),
          target,
          factionId,
          factionName,
          color,
          region,
          targetCountryId: selectedId,
          preserveLabels: extend,
          extensionMode: extend,
        }),
      );
    },
    [currentFrame, activeColor, runMutation],
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

  const setTerritoryDrawMode = useCallback((mode: TerritoryDrawMode) => {
    dispatch({ type: 'SET_TERRITORY_DRAW_MODE', mode });
  }, []);

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

  const addPaletteColor = useCallback((name: string, hex: string) => {
    dispatch({
      type: 'ADD_PALETTE_COLOR',
      color: { id: uuidv4(), name, hex },
    });
  }, []);

  const updateFactionMetadata = useCallback(
    async (factionId: string, patch: { name?: string; hex?: string }) => {
      await runMutation(() =>
        api.updateFactionMetadata({
          project: toProjectBody(stateRef.current),
          factionId,
          ...patch,
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
      dispatch({ type: 'SET_VIEWPORT', viewport: { scale: 1, x: 0, y: 0 } });
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
        dispatch({ type: 'SET_VIEWPORT', viewport: { scale: 1, x: 0, y: 0 } });
        return true;
      } catch {
        return false;
      }
    },
    [runMutation, knownFilenames],
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
      setViewport,
      addTerritoryRegion,
      claimAnchor,
      removeTerritoryVertex,
      moveTerritoryVertex,
      deleteCountry,
      setSelectedCountry,
      setTerritoryDrawMode,
      updateFrameInfo,
      addPaletteColor,
      updateFactionMetadata,
      exportProject,
      importProject,
      duplicateFrame,
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
      setViewport,
      addTerritoryRegion,
      claimAnchor,
      removeTerritoryVertex,
      moveTerritoryVertex,
      deleteCountry,
      setSelectedCountry,
      setTerritoryDrawMode,
      updateFrameInfo,
      addPaletteColor,
      updateFactionMetadata,
      exportProject,
      importProject,
      duplicateFrame,
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
