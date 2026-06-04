import type { PaletteColor } from '../types/project';

const PRESET_HEX = [
  '#ff2d55',
  '#448aff',
  '#00e676',
  '#ffc400',
  '#e040fb',
  '#ff6b00',
  '#00e5ff',
  '#78909c',
  '#ab47bc',
  '#26a69a',
];

/** Next unused preset hex, or cycle when all are taken. */
export function defaultHexForPalette(palette: PaletteColor[]): string {
  const used = new Set(palette.map((p) => p.hex.toLowerCase()));
  for (const hex of PRESET_HEX) {
    if (!used.has(hex.toLowerCase())) return hex;
  }
  return PRESET_HEX[palette.length % PRESET_HEX.length]!;
}

export function normalizeHexInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toLowerCase();
}
