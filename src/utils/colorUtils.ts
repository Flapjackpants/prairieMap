/** Mix hex color toward white (0 = unchanged, 1 = white). */
export function lightenHex(hex: string, mix = 0.38): string {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * mix);
  const toHex = (n: number) => blend(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function extensionColorForCountry(color: string, stored?: string): string {
  return stored ?? lightenHex(color);
}
