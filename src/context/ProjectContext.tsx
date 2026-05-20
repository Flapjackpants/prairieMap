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
  createEmptyFrameData,
  DEFAULT_PALETTE,
  type DrawStroke,
  type FrameData,
  type MapFrame,
  type MapLabel,
  type PaletteColor,
  type ProjectExport,
  type ProjectState,
  type ToolMode,
  type ViewportState,
  type FrameInfo,
  type FrameAnnotations,
} from '../types/project';
import { filterAndSortImageFiles } from '../utils/sortFiles';

type ProjectAction =
  | { type: 'LOAD_FRAMES'; files: File[] }
  | { type: 'SET_FRAME_INDEX'; index: number }
  | { type: 'SET_TOOL'; tool: ToolMode }
  | { type: 'SET_ACTIVE_COLOR'; colorId: string }
  | { type: 'SET_BRUSH_SIZE'; size: number }
  | { type: 'SET_BRUSH_OPACITY'; opacity: number }
  | { type: 'TOGGLE_CARRY_LABELS' }
  | { type: 'SET_VIEWPORT'; viewport: ViewportState }
  | { type: 'ADD_STROKE'; frameId: string; stroke: DrawStroke }
  | { type: 'SET_ANNOTATIONS'; frameId: string; annotations: FrameAnnotations }
  | { type: 'UPDATE_LABEL'; frameId: string; label: MapLabel }
  | { type: 'DELETE_LABEL'; frameId: string; labelId: string }
  | { type: 'UPDATE_FRAME_INFO'; frameId: string; info: Partial<FrameInfo> }
  | { type: 'ADD_PALETTE_COLOR'; color: PaletteColor }
  | { type: 'UPDATE_PALETTE_COLOR'; color: PaletteColor }
  | { type: 'REMOVE_PALETTE_COLOR'; colorId: string }
  | { type: 'IMPORT_PROJECT'; exportData: ProjectExport; frames: MapFrame[] }
  | { type: 'CLEAR_FRAMES' };

const initialState: ProjectState = {
  frames: [],
  frameData: {},
  currentFrameIndex: 0,
  palette: DEFAULT_PALETTE,
  activeColorId: DEFAULT_PALETTE[0].id,
  tool: 'pan',
  brushSize: 24,
  brushOpacity: 0.45,
  carryOverLabels: true,
  viewport: { scale: 1, x: 0, y: 0 },
};

function mergeCarriedLabels(
  prevAnnotations: FrameAnnotations,
  nextAnnotations: FrameAnnotations,
  carry: boolean,
): FrameAnnotations {
  if (!carry) return nextAnnotations;
  const existingIds = new Set(nextAnnotations.labels.map((l) => l.id));
  const carried = prevAnnotations.labels.filter((l) => !existingIds.has(l.id));
  return {
    ...nextAnnotations,
    labels: [...carried, ...nextAnnotations.labels],
  };
}

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'LOAD_FRAMES': {
      const sorted = filterAndSortImageFiles(action.files);
      const newFrames: MapFrame[] = sorted.map((file) => ({
        id: uuidv4(),
        filename: file.name,
        objectUrl: URL.createObjectURL(file),
        file,
      }));

      state.frames.forEach((f) => URL.revokeObjectURL(f.objectUrl));

      const frameData: Record<string, FrameData> = {};
      newFrames.forEach((frame) => {
        frameData[frame.id] = createEmptyFrameData();
      });

      return {
        ...state,
        frames: newFrames,
        frameData,
        currentFrameIndex: 0,
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'SET_FRAME_INDEX': {
      const index = Math.max(0, Math.min(action.index, state.frames.length - 1));
      if (index === state.currentFrameIndex) return state;

      const prevFrame = state.frames[state.currentFrameIndex];
      const nextFrame = state.frames[index];
      if (!prevFrame || !nextFrame) return { ...state, currentFrameIndex: index };

      const prevData = state.frameData[prevFrame.id];
      const nextData = state.frameData[nextFrame.id];
      if (state.carryOverLabels && prevData && nextData) {
        const merged = mergeCarriedLabels(
          prevData.annotations,
          nextData.annotations,
          true,
        );
        return {
          ...state,
          currentFrameIndex: index,
          frameData: {
            ...state.frameData,
            [nextFrame.id]: {
              ...nextData,
              annotations: merged,
            },
          },
          viewport: { scale: 1, x: 0, y: 0 },
        };
      }

      return {
        ...state,
        currentFrameIndex: index,
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

    case 'ADD_STROKE': {
      const data = state.frameData[action.frameId];
      if (!data) return state;
      return {
        ...state,
        frameData: {
          ...state.frameData,
          [action.frameId]: {
            ...data,
            annotations: {
              ...data.annotations,
              strokes: [...data.annotations.strokes, action.stroke],
            },
          },
        },
      };
    }

    case 'SET_ANNOTATIONS': {
      const data = state.frameData[action.frameId];
      if (!data) return state;
      return {
        ...state,
        frameData: {
          ...state.frameData,
          [action.frameId]: {
            ...data,
            annotations: action.annotations,
          },
        },
      };
    }

    case 'UPDATE_LABEL': {
      const data = state.frameData[action.frameId];
      if (!data) return state;
      const labels = data.annotations.labels.some((l) => l.id === action.label.id)
        ? data.annotations.labels.map((l) =>
            l.id === action.label.id ? action.label : l,
          )
        : [...data.annotations.labels, action.label];
      return {
        ...state,
        frameData: {
          ...state.frameData,
          [action.frameId]: {
            ...data,
            annotations: { ...data.annotations, labels },
          },
        },
      };
    }

    case 'DELETE_LABEL': {
      const data = state.frameData[action.frameId];
      if (!data) return state;
      return {
        ...state,
        frameData: {
          ...state.frameData,
          [action.frameId]: {
            ...data,
            annotations: {
              ...data.annotations,
              labels: data.annotations.labels.filter((l) => l.id !== action.labelId),
            },
          },
        },
      };
    }

    case 'UPDATE_FRAME_INFO': {
      const data = state.frameData[action.frameId];
      if (!data) return state;
      return {
        ...state,
        frameData: {
          ...state.frameData,
          [action.frameId]: {
            ...data,
            info: { ...data.info, ...action.info },
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

    case 'IMPORT_PROJECT': {
      state.frames.forEach((f) => URL.revokeObjectURL(f.objectUrl));
      const frameData: Record<string, FrameData> = {};
      action.frames.forEach((frame, i) => {
        const exportEntry = action.exportData.frames[i];
        frameData[frame.id] = exportEntry
          ? { annotations: exportEntry.annotations, info: exportEntry.info }
          : createEmptyFrameData();
      });
      return {
        ...state,
        frames: action.frames,
        frameData,
        currentFrameIndex: 0,
        palette: action.exportData.palette,
        carryOverLabels: action.exportData.carryOverLabels,
        activeColorId: action.exportData.palette[0]?.id ?? state.activeColorId,
        viewport: { scale: 1, x: 0, y: 0 },
      };
    }

    case 'CLEAR_FRAMES': {
      state.frames.forEach((f) => URL.revokeObjectURL(f.objectUrl));
      return { ...initialState, palette: state.palette, activeColorId: state.activeColorId };
    }

    default:
      return state;
  }
}

interface ProjectContextValue {
  state: ProjectState;
  currentFrame: MapFrame | null;
  currentFrameData: FrameData | null;
  activeColor: PaletteColor | undefined;
  loadFolder: (files: FileList) => void;
  setFrameIndex: (index: number) => void;
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
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const currentFrame = state.frames[state.currentFrameIndex] ?? null;
  const currentFrameData = currentFrame ? state.frameData[currentFrame.id] ?? null : null;
  const activeColor = state.palette.find((c) => c.id === state.activeColorId);

  const loadFolder = useCallback((files: FileList) => {
    dispatch({ type: 'LOAD_FRAMES', files: Array.from(files) });
  }, []);

  const setFrameIndex = useCallback((index: number) => {
    dispatch({ type: 'SET_FRAME_INDEX', index });
  }, []);

  const nextFrame = useCallback(() => {
    dispatch({ type: 'SET_FRAME_INDEX', index: state.currentFrameIndex + 1 });
  }, [state.currentFrameIndex]);

  const prevFrame = useCallback(() => {
    dispatch({ type: 'SET_FRAME_INDEX', index: state.currentFrameIndex - 1 });
  }, [state.currentFrameIndex]);

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
      if (!currentFrame) return;
      dispatch({ type: 'ADD_STROKE', frameId: currentFrame.id, stroke });
    },
    [currentFrame],
  );

  const updateLabel = useCallback(
    (label: MapLabel) => {
      if (!currentFrame) return;
      dispatch({ type: 'UPDATE_LABEL', frameId: currentFrame.id, label });
    },
    [currentFrame],
  );

  const deleteLabel = useCallback(
    (labelId: string) => {
      if (!currentFrame) return;
      dispatch({ type: 'DELETE_LABEL', frameId: currentFrame.id, labelId });
    },
    [currentFrame],
  );

  const updateFrameInfo = useCallback(
    (info: Partial<FrameInfo>) => {
      if (!currentFrame) return;
      dispatch({ type: 'UPDATE_FRAME_INFO', frameId: currentFrame.id, info });
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
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      palette: state.palette,
      carryOverLabels: state.carryOverLabels,
      frames: state.frames.map((frame) => {
        const data = state.frameData[frame.id] ?? createEmptyFrameData();
        return {
          filename: frame.filename,
          annotations: data.annotations,
          info: data.info,
        };
      }),
    };
  }, [state]);

  const importProject = useCallback((data: ProjectExport, files: File[]) => {
    const sorted = filterAndSortImageFiles(files);
    const frames: MapFrame[] = sorted.map((file) => ({
      id: uuidv4(),
      filename: file.name,
      objectUrl: URL.createObjectURL(file),
      file,
    }));
    dispatch({ type: 'IMPORT_PROJECT', exportData: data, frames });
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      state,
      currentFrame,
      currentFrameData,
      activeColor,
      loadFolder,
      setFrameIndex,
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
    }),
    [
      state,
      currentFrame,
      currentFrameData,
      activeColor,
      loadFolder,
      setFrameIndex,
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
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
