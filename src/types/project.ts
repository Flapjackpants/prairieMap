export type ToolMode = 'pan' | 'areaSelect' | 'select';

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

/** Closed polygon as [x, y] pairs in image space */
export type PolygonRing = [number, number][];

export interface CountryLabelSettings {
  fontSize: number;
  rotation: number;
  letterSpacing: number;
}

/** Flat label placement for one disconnected region (exclave). */
export interface RegionLabelPlacement {
  x: number;
  y: number;
  fontSize: number;
  letterSpacing: number;
}

export interface CountryTerritory {
  id: string;
  factionId: string;
  name: string;
  color: string;
  labelSettings: CountryLabelSettings;
  /** One label per region ring (exclaves after union). */
  regionLabels: RegionLabelPlacement[];
  regions: PolygonRing[];
}

export interface TerritoryDrawings {
  countries: CountryTerritory[];
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
  countries: CountryTerritory[];
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
export const TERRITORY_FILL_OPACITY = 0.4;
export const TERRITORY_OUTLINE_WIDTH = 1.5;
export const SNAP_THRESHOLD_PX = 14;

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
  carryOverLabels: boolean;
  viewport: ViewportState;
  selectedCountryId: string | null;
}

export interface ProjectExportV2 {
  version: 2;
  projectName: string;
  exportedAt: string;
  palette: PaletteColor[];
  carryOverLabels: boolean;
  assets: Record<
    string,
    {
      drawings: TerritoryDrawings | LegacyDrawingsExport;
      infoBoard: {
        date: string;
        text: string;
        factionStats: FactionStat[];
      };
    }[]
  >;
  timeline: TimelineEntry[];
}

/** Legacy stroke/label export shape */
export interface LegacyDrawingsExport {
  countries?: CountryTerritory[];
  strokes?: unknown[];
  labels?: unknown[];
}

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
  { id: 'crimson', name: 'nation1', hex: '#ff2d55' },
  { id: 'blue', name: 'nation2', hex: '#448aff' },
  { id: 'emerald', name: 'nation3', hex: '#00e676' },
  { id: 'amber', name: 'nation4', hex: '#ffc400' },
];

export function createEmptyFrameInfo(): FrameInfo {
  return {
    dateTitle: '',
    description: '',
    factionStats: [],
  };
}

export function createEmptyAnnotations(): FrameAnnotations {
  return { countries: [] };
}

export function createEmptyAssetState(): AssetFrameState {
  return {
    annotations: createEmptyAnnotations(),
    info: createEmptyFrameInfo(),
  };
}
