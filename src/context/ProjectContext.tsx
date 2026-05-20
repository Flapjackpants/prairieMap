import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  createEmptyAnnotations,
  createEmptyAssetState,
  createEmptyFrameInfo,
  DEFAULT_PALETTE,
  isBlankAssetKey,
  type AssetFrameState,
  type DrawStroke,
  type FrameAnnotations,
  type FrameDuplicateOptions,
  type FrameInfo,
  type MapLabel,
  type PaletteColor,
  type ProjectExport,
  type ProjectState,
  type ResolvedFrame,
  type TimelineEntry,
  type ToolMode,
  type ViewportState,
} from '../types/project';
import { cloneAnnotations, cloneFrameInfo } from '../utils/cloneFrameData';
import { importToAssets, stateToExport } from '../utils/exportSchema';
import {
  cleanupAssetCopies,
  clampTimelineIndex,
  displayFilename,
  getAssetState,
  getNextMapFilename,
  resolveCurrentFrame,
} from '../utils/projectHelpers';
import {
  initProjectFromFolder,
  reconcileFolderWithProject,
  revokeFileRegistry,
} from '../utils/reconcileFolder';

type AssetTarget = { filename: string; copyIndex: number };

type ProjectAction =
  | { type: 'LOAD_FOLDER'; files: File[] }
  | { type: 'IMPORT_PROJECT'; exportData: ProjectExport; files: File[] }
  | { type: 'SET_TIMELINE_INDEX'; index: number }
  | { type: 'REORDER_TIMELINE'; fromIndex: number; toIndex: number }
  | { type: 'DELETE_TIMELINE_ENTRY'; index: number }
  | { type: 'DUPLICATE_FRAME'; sourceIndex: number; options: FrameDuplicateOptions }
  | { type: 'SET_TOOL'; tool: ToolMode }
  | { type: 'SET_ACTIVE_COLOR'; colorId: string }
  | { type: 'SET_BRUSH_SIZE'; size: number }
  | { type: 'SET_BRUSH_OPACITY'; opacity: number }
  | { type: 'TOGGLE_CARRY_LABELS' }
  | { type: 'SET_VIEWPORT'; viewport: ViewportState }
  | { type: 'ADD_STROKE'; target: AssetTarget; stroke: DrawStroke }
  | { type: 'UPDATE_LABEL'; target: AssetTarget; label: MapLabel }
  | { type: 'DELETE_LABEL'; target: AssetTarget; labelId: string }
  | { type: 'UPDATE_FRAME_INFO'; target: AssetTarget; info: Partial<FrameInfo> }
  | { type: 'SET_ASSET_STATE'; target: AssetTarget; state: AssetFrameState }
  | { type: 'ADD_PALETTE_COLOR'; color: PaletteColor }
  | { type: 'UPDATE_PALETTE_COLOR'; color: PaletteColor }
  | { type: 'REMOVE_PALETTE_COLOR'; colorId: string }
  | { type: 'SET_FILE_CANVAS_SIZE'; filename: string; width: number; height: number }
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
  brushSize: 24,
  brushOpacity: 0.45,
  carryOverLabels: true,
  viewport: { scale: 1, x: 0, y: 0 },
};

function mergeCarriedLabels(
  prev: FrameAnnotations,
  next: FrameAnnotations,
): FrameAnnotations {
  const existingIds = new Set(next.labels.map((l) => l.id));
  const carried = prev.labels.filter((l) => !existingIds.has(l.id));
  return { ...next, labels: [...carried, ...next.labels] };
}

function updateAssetAt(
  assets: Record<string, AssetFrameState[]>,
  target: AssetTarget,
  updater: (state: AssetFrameState) => AssetFrameState,
): Record<string, AssetFrameState[]> {
  const next = { ...assets };
  const current = getAssetState(next, target.filename, target.copyIndex);
  const updated = updater(current);
  const copies = [...(next[target.filename] ?? [])];
  while (copies.length <= target.copyIndex) {
    copies.push(createEmptyAssetState());
  }
  copies[target.copyIndex] = updated;
  next[target.filename] = copies;
  return next;
}

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'LOAD_FOLDER': {
      revokeFileRegistry(state.fileRegistry);
      if (state.timeline.length === 0) {
        const init = initProjectFromFolder(action.files);
        return {
          ...state,
          ...init,
          currentTimelineIndex: 0,
          viewport: { scale: 1, x: 0, y: 0 },
        };
      }
      const reconciled = reconcileFolderWithProject(action.files, {
        assets: state.assets,
        timeline: state.timeline,
        projectName: state.projectName,
        palette: state.palette,
        carryOverLabels: state.carryOverLabels,
      });
      return {
        ...state,
        assets: reconciled.assets,
        timeline: reconciled.timeline,
        fileRegistry: reconciled.fileRegistry,
        currentTimelineIndex: clampTimelineIndex(
          state.currentTimelineIndex,
          reconciled.timeline.length,
        ),
      };
    }

    case 'IMPORT_PROJECT': {
      revokeFileRegistry(state.fileRegistry);
      const imported = importToAssets(action.exportData);
      const reconciled = reconcileFolderWithProject(action.files, {
        assets: imported.assets,
        timeline: imported.timeline,
        projectName: imported.projectName,
        palette: imported.palette,
        carryOverLabels: imported.carryOverLabels,
      });
      return {
        ...state,
        projectName: imported.projectName,
        assets: reconciled.assets,
        timeline: reconciled.timeline,
        fileRegistry: reconciled.fileRegistry,
        palette: imported.palette,
        carryOverLabels: imported.carryOverLabels,
        activeColorId: imported.palette[0]?.id ?? state.activeColorId,
        currentTimelineIndex: 0,
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'SET_TIMELINE_INDEX': {
      const index = clampTimelineIndex(action.index, state.timeline.length);
      if (index === state.currentTimelineIndex || state.timeline.length === 0) {
        return { ...state, currentTimelineIndex: index };
      }

      const prevEntry = state.timeline[state.currentTimelineIndex];
      const nextEntry = state.timeline[index];
      if (!prevEntry || !nextEntry) {
        return { ...state, currentTimelineIndex: index, viewport: { scale: 1, x: 0, y: 0 } };
      }

      if (state.carryOverLabels) {
        const prevData = getAssetState(state.assets, prevEntry.filename, prevEntry.copyIndex);
        const nextData = getAssetState(state.assets, nextEntry.filename, nextEntry.copyIndex);
        const merged = mergeCarriedLabels(prevData.annotations, nextData.annotations);
        const assets = updateAssetAt(
          state.assets,
          { filename: nextEntry.filename, copyIndex: nextEntry.copyIndex },
          (s) => ({ ...s, annotations: merged }),
        );
        return {
          ...state,
          assets,
          currentTimelineIndex: index,
          viewport: { scale: 1, x: 0, y: 0 },
        };
      }

      return {
        ...state,
        currentTimelineIndex: index,
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'REORDER_TIMELINE': {
      const { fromIndex, toIndex } = action;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.timeline.length ||
        toIndex >= state.timeline.length
      ) {
        return state;
      }
      const timeline = [...state.timeline];
      const [moved] = timeline.splice(fromIndex, 1);
      timeline.splice(toIndex, 0, moved);

      let currentTimelineIndex = state.currentTimelineIndex;
      if (currentTimelineIndex === fromIndex) {
        currentTimelineIndex = toIndex;
      } else if (fromIndex < currentTimelineIndex && toIndex >= currentTimelineIndex) {
        currentTimelineIndex -= 1;
      } else if (fromIndex > currentTimelineIndex && toIndex <= currentTimelineIndex) {
        currentTimelineIndex += 1;
      }

      return { ...state, timeline, currentTimelineIndex };
    }

    case 'DELETE_TIMELINE_ENTRY': {
      if (state.timeline.length === 0) return state;
      const deleteIndex = clampTimelineIndex(action.index, state.timeline.length);
      const timeline = state.timeline.filter((_, i) => i !== deleteIndex);

      let currentTimelineIndex = state.currentTimelineIndex;
      if (timeline.length === 0) {
        currentTimelineIndex = 0;
      } else if (deleteIndex < currentTimelineIndex) {
        currentTimelineIndex -= 1;
      } else if (deleteIndex === currentTimelineIndex) {
        currentTimelineIndex = Math.min(deleteIndex, timeline.length - 1);
      }

      const cleaned = cleanupAssetCopies(state.assets, timeline);
      return {
        ...state,
        assets: cleaned.assets,
        timeline: cleaned.timeline,
        currentTimelineIndex: clampTimelineIndex(currentTimelineIndex, timeline.length),
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'DUPLICATE_FRAME': {
      const sourceEntry = state.timeline[action.sourceIndex];
      if (!sourceEntry) return state;

      const sourceData = getAssetState(
        state.assets,
        sourceEntry.filename,
        sourceEntry.copyIndex,
      );
      const { options } = action;
      const insertIndex = action.sourceIndex + 1;

      let assetFilename: string;
      if (options.duplicateMapImage) {
        assetFilename = isBlankAssetKey(sourceEntry.filename)
          ? displayFilename(sourceEntry.filename)
          : sourceEntry.filename;
      } else {
        const nextMap = getNextMapFilename(
          state.timeline,
          state.fileRegistry,
          action.sourceIndex,
        );
        if (!nextMap) return state;
        assetFilename = nextMap;
      }

      const newState: AssetFrameState = {
        annotations: options.duplicateAnnotations
          ? cloneAnnotations(sourceData.annotations)
          : createEmptyAnnotations(),
        info: options.duplicateInfoBoard
          ? cloneFrameInfo(sourceData.info)
          : createEmptyFrameInfo(),
      };

      const assets = { ...state.assets };
      if (!assets[assetFilename]) assets[assetFilename] = [];
      const copyIndex = assets[assetFilename].length;
      assets[assetFilename] = [...assets[assetFilename], newState];

      const newEntry: TimelineEntry = {
        id: uuidv4(),
        filename: assetFilename,
        copyIndex,
      };

      const timeline = [
        ...state.timeline.slice(0, insertIndex),
        newEntry,
        ...state.timeline.slice(insertIndex),
      ];

      return {
        ...state,
        assets,
        timeline,
        currentTimelineIndex: insertIndex,
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'SET_TOOL':
      return { ...state, tool: action.tool };

    case 'SET_ACTIVE_COLOR':
      return { ...state, activeColorId: action.colorId };

    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.size };

    case 'SET_BRUSH_OPACITY':
      return { ...state, brushOpacity: action.opacity };

    case 'TOGGLE_CARRY_LABELS':
      return { ...state, carryOverLabels: !state.carryOverLabels };

    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };

    case 'ADD_STROKE':
      return {
        ...state,
        assets: updateAssetAt(state.assets, action.target, (s) => ({
          ...s,
          annotations: {
            ...s.annotations,
            strokes: [...s.annotations.strokes, action.stroke],
          },
        })),
      };

    case 'UPDATE_LABEL': {
      return {
        ...state,
        assets: updateAssetAt(state.assets, action.target, (s) => {
          const exists = s.annotations.labels.some((l) => l.id === action.label.id);
          const labels = exists
            ? s.annotations.labels.map((l) =>
                l.id === action.label.id ? action.label : l,
              )
            : [...s.annotations.labels, action.label];
          return { ...s, annotations: { ...s.annotations, labels } };
        }),
      };
    }

    case 'DELETE_LABEL':
      return {
        ...state,
        assets: updateAssetAt(state.assets, action.target, (s) => ({
          ...s,
          annotations: {
            ...s.annotations,
            labels: s.annotations.labels.filter((l) => l.id !== action.labelId),
          },
        })),
      };

    case 'UPDATE_FRAME_INFO':
      return {
        ...state,
        assets: updateAssetAt(state.assets, action.target, (s) => ({
          ...s,
          info: { ...s.info, ...action.info },
        })),
      };

    case 'SET_ASSET_STATE':
      return {
        ...state,
        assets: updateAssetAt(state.assets, action.target, () => action.state),
      };

    case 'ADD_PALETTE_COLOR':
      return {
        ...state,
        palette: [...state.palette, action.color],
        activeColorId: action.color.id,
      };

    case 'UPDATE_PALETTE_COLOR':
      return {
        ...state,
        palette: state.palette.map((c) =>
          c.id === action.color.id ? action.color : c,
        ),
      };

    case 'REMOVE_PALETTE_COLOR': {
      const palette = state.palette.filter((c) => c.id !== action.colorId);
      const activeColorId =
        state.activeColorId === action.colorId
          ? palette[0]?.id ?? ''
          : state.activeColorId;
      return { ...state, palette, activeColorId };
    }

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

    case 'CLEAR_PROJECT': {
      revokeFileRegistry(state.fileRegistry);
      return { ...initialState, palette: state.palette, activeColorId: state.activeColorId };
    }

    default:
      return state;
  }
}

interface ProjectContextValue {
  state: ProjectState;
  currentFrame: ResolvedFrame | null;
  activeColor: PaletteColor | undefined;
  loadFolder: (files: FileList) => void;
  setTimelineIndex: (index: number) => void;
  reorderTimeline: (fromIndex: number, toIndex: number) => void;
  deleteFrame: (index: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;
  setTool: (tool: ToolMode) => void;
  setActiveColor: (colorId: string) => void;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  toggleCarryLabels: () => void;
  setViewport: (viewport: ViewportState) => void;
  addStroke: (stroke: DrawStroke) => void;
  updateLabel: (label: MapLabel) => void;
  deleteLabel: (labelId: string) => void;
  updateFrameInfo: (info: Partial<FrameInfo>) => void;
  addPaletteColor: (name: string, hex: string) => void;
  exportProject: () => ProjectExport;
  importProject: (data: ProjectExport, files: File[]) => void;
  duplicateFrame: (sourceIndex: number, options: FrameDuplicateOptions) => boolean;
  setFileCanvasSize: (filename: string, width: number, height: number) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function currentTarget(frame: ResolvedFrame | null): AssetTarget | null {
  if (!frame) return null;
  return { filename: frame.filename, copyIndex: frame.copyIndex };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const currentFrame = useMemo(() => resolveCurrentFrame(state), [state]);
  const activeColor = state.palette.find((c) => c.id === state.activeColorId);

  const loadFolder = useCallback((files: FileList) => {
    dispatch({ type: 'LOAD_FOLDER', files: Array.from(files) });
  }, []);

  const setTimelineIndex = useCallback((index: number) => {
    dispatch({ type: 'SET_TIMELINE_INDEX', index });
  }, []);

  const reorderTimeline = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_TIMELINE', fromIndex, toIndex });
  }, []);

  const deleteFrame = useCallback((index: number) => {
    dispatch({ type: 'DELETE_TIMELINE_ENTRY', index });
  }, []);

  const nextFrame = useCallback(() => {
    dispatch({ type: 'SET_TIMELINE_INDEX', index: state.currentTimelineIndex + 1 });
  }, [state.currentTimelineIndex]);

  const prevFrame = useCallback(() => {
    dispatch({ type: 'SET_TIMELINE_INDEX', index: state.currentTimelineIndex - 1 });
  }, [state.currentTimelineIndex]);

  const setTool = useCallback((tool: ToolMode) => {
    dispatch({ type: 'SET_TOOL', tool });
  }, []);

  const setActiveColor = useCallback((colorId: string) => {
    dispatch({ type: 'SET_ACTIVE_COLOR', colorId });
  }, []);

  const setBrushSize = useCallback((size: number) => {
    dispatch({ type: 'SET_BRUSH_SIZE', size });
  }, []);

  const setBrushOpacity = useCallback((opacity: number) => {
    dispatch({ type: 'SET_BRUSH_OPACITY', opacity });
  }, []);

  const toggleCarryLabels = useCallback(() => {
    dispatch({ type: 'TOGGLE_CARRY_LABELS' });
  }, []);

  const setViewport = useCallback((viewport: ViewportState) => {
    dispatch({ type: 'SET_VIEWPORT', viewport });
  }, []);

  const addStroke = useCallback(
    (stroke: DrawStroke) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      dispatch({ type: 'ADD_STROKE', target, stroke });
    },
    [currentFrame],
  );

  const updateLabel = useCallback(
    (label: MapLabel) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      dispatch({ type: 'UPDATE_LABEL', target, label });
    },
    [currentFrame],
  );

  const deleteLabel = useCallback(
    (labelId: string) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      dispatch({ type: 'DELETE_LABEL', target, labelId });
    },
    [currentFrame],
  );

  const updateFrameInfo = useCallback(
    (info: Partial<FrameInfo>) => {
      const target = currentTarget(currentFrame);
      if (!target) return;
      dispatch({ type: 'UPDATE_FRAME_INFO', target, info });
    },
    [currentFrame],
  );

  const addPaletteColor = useCallback((name: string, hex: string) => {
    dispatch({
      type: 'ADD_PALETTE_COLOR',
      color: { id: uuidv4(), name, hex },
    });
  }, []);

  const exportProject = useCallback((): ProjectExport => {
    return stateToExport(state);
  }, [state]);

  const importProject = useCallback((data: ProjectExport, files: File[]) => {
    dispatch({ type: 'IMPORT_PROJECT', exportData: data, files });
  }, []);

  const duplicateFrame = useCallback(
    (sourceIndex: number, options: FrameDuplicateOptions): boolean => {
      if (!options.duplicateMapImage) {
        const nextMap = getNextMapFilename(
          state.timeline,
          state.fileRegistry,
          sourceIndex,
        );
        if (!nextMap) {
          return false;
        }
      }
      dispatch({ type: 'DUPLICATE_FRAME', sourceIndex, options });
      return true;
    },
    [state.timeline, state.fileRegistry],
  );

  const setFileCanvasSize = useCallback((filename: string, width: number, height: number) => {
    dispatch({ type: 'SET_FILE_CANVAS_SIZE', filename, width, height });
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      state,
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
      setBrushSize,
      setBrushOpacity,
      toggleCarryLabels,
      setViewport,
      addStroke,
      updateLabel,
      deleteLabel,
      updateFrameInfo,
      addPaletteColor,
      exportProject,
      importProject,
      duplicateFrame,
      setFileCanvasSize,
    }),
    [
      state,
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
      setBrushSize,
      setBrushOpacity,
      toggleCarryLabels,
      setViewport,
      addStroke,
      updateLabel,
      deleteLabel,
      updateFrameInfo,
      addPaletteColor,
      exportProject,
      importProject,
      duplicateFrame,
      setFileCanvasSize,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
