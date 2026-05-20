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

export interface MapFrame {
  id: string;
  filename: string;
  objectUrl: string;
  file: File;
}

export interface FrameData {
  annotations: FrameAnnotations;
  info: FrameInfo;
}

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

export interface ProjectState {
  frames: MapFrame[];
  frameData: Record<string, FrameData>;
  currentFrameIndex: number;
  palette: PaletteColor[];
  activeColorId: string;
  tool: ToolMode;
  brushSize: number;
  brushOpacity: number;
  carryOverLabels: boolean;
  viewport: ViewportState;
}

export interface ProjectExport {
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

export function createEmptyFrameData(): FrameData {
  return {
    annotations: createEmptyAnnotations(),
    info: createEmptyFrameInfo(),
  };
}
