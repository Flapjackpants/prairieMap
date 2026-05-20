export type ToolMode = 'pan' | 'brush' | 'bucket' | 'text' | 'select';

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  points: StrokePoint[];
  color: string;
  size: number;
  opacity: number;
}

export interface MapLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  width?: number;
}

export interface FactionStat {
  id: string;
  factionId: string;
  metric: string;
  value: string;
}

export interface FrameInfo {
  dateTitle: string;
  description: string;
  factionStats: FactionStat[];
}

export interface FrameAnnotations {
  strokes: DrawStroke[];
  labels: MapLabel[];
}

/** Per-copy editable state stored in assets[filename][copyIndex] */
export interface AssetFrameState {
  annotations: FrameAnnotations;
  info: FrameInfo;
}

export interface TimelineEntry {
  id: string;
  filename: string;
  copyIndex: number;
}

export interface FileRegistryEntry {
  file: File | null;
  objectUrl: string | null;
  canvasWidth: number;
  canvasHeight: number;
}

export interface ResolvedFrame {
  timelineIndex: number;
  entry: TimelineEntry;
  filename: string;
  copyIndex: number;
  isMissing: boolean;
  isBlank: boolean;
  objectUrl: string | null;
  file: File | null;
  canvasWidth: number;
  canvasHeight: number;
  frameData: AssetFrameState;
}

export interface FrameDuplicateOptions {
  duplicateMapImage: boolean;
  duplicateAnnotations: boolean;
  duplicateInfoBoard: boolean;
}

export const DEFAULT_DUPLICATE_OPTIONS: FrameDuplicateOptions = {
  duplicateMapImage: true,
  duplicateAnnotations: true,
  duplicateInfoBoard: true,
};

export const DEFAULT_CANVAS_SIZE = { width: 1920, height: 1080 } as const;

/** Synthetic asset key for blank-canvas copies (no map image). */
export const BLANK_ASSET_PREFIX = '__blank__/';

export function isBlankAssetKey(filename: string): boolean {
  return filename.startsWith(BLANK_ASSET_PREFIX);
}

export function blankAssetKey(sourceFilename: string): string {
  return `${BLANK_ASSET_PREFIX}${sourceFilename}`;
}

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

export interface ProjectState {
  projectName: string;
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
  fileRegistry: Record<string, FileRegistryEntry>;
  currentTimelineIndex: number;
  palette: PaletteColor[];
  activeColorId: string;
  tool: ToolMode;
  brushSize: number;
  brushOpacity: number;
  carryOverLabels: boolean;
  viewport: ViewportState;
}

/** Serialized project (v2) */
export interface ProjectExportV2 {
  version: 2;
  projectName: string;
  exportedAt: string;
  palette: PaletteColor[];
  carryOverLabels: boolean;
  assets: Record<
    string,
    {
      drawings: DrawStroke[];
      labels: MapLabel[];
      infoBoard: {
        date: string;
        text: string;
        factionStats: FactionStat[];
      };
    }[]
  >;
  timeline: TimelineEntry[];
}

/** Legacy v1 export for migration */
export interface ProjectExportV1 {
  version: 1;
  exportedAt: string;
  palette: PaletteColor[];
  carryOverLabels: boolean;
  frames: {
    filename: string;
    annotations: FrameAnnotations;
    info: FrameInfo;
  }[];
}

export type ProjectExport = ProjectExportV2 | ProjectExportV1;

export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: 'crimson', name: 'Crimson Legion', hex: '#ff2d55' },
  { id: 'blue', name: 'Electric Coalition', hex: '#448aff' },
  { id: 'emerald', name: 'Emerald Front', hex: '#00e676' },
  { id: 'amber', name: 'Amber Dominion', hex: '#ffc400' },
];

export function createEmptyFrameInfo(): FrameInfo {
  return {
    dateTitle: '',
    description: '',
    factionStats: [],
  };
}

export function createEmptyAnnotations(): FrameAnnotations {
  return {
    strokes: [],
    labels: [],
  };
}

export function createEmptyAssetState(): AssetFrameState {
  return {
    annotations: createEmptyAnnotations(),
    info: createEmptyFrameInfo(),
  };
}
