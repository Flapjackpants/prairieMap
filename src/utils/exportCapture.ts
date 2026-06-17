import type { DivisionMarker, PaletteColor } from '../types/project';
import { isBlankAssetKey } from '../types/project';
import type { FileRegistryEntry } from '../types/project';
import { acquire } from './mapImageCache';

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function preloadDivisionImages(
  fileRegistry: Record<string, FileRegistryEntry>,
  divisions: DivisionMarker[],
): Promise<Record<string, HTMLImageElement>> {
  const filenames = [
    ...new Set(
      divisions
        .map((d) => d.sourceFilename)
        .filter((f) => f && !isBlankAssetKey(f)),
    ),
  ];
  const map: Record<string, HTMLImageElement> = {};
  await Promise.all(
    filenames.map(async (filename) => {
      const file = fileRegistry[filename]?.file;
      if (!file) return;
      const url = acquire(filename, file);
      try {
        map[filename] = await loadImageFromUrl(url);
      } catch {
        /* missing asset */
      }
    }),
  );
  return map;
}

export async function preloadFlagImages(
  fileRegistry: Record<string, FileRegistryEntry>,
  palette: PaletteColor[],
): Promise<Record<string, HTMLImageElement>> {
  const filenames = [
    ...new Set(
      palette
        .map((p) => p.flagFilename)
        .filter((f): f is string => Boolean(f && !isBlankAssetKey(f))),
    ),
  ];
  const map: Record<string, HTMLImageElement> = {};
  await Promise.all(
    filenames.map(async (filename) => {
      const file = fileRegistry[filename]?.file;
      if (!file) return;
      const url = acquire(filename, file);
      try {
        map[filename] = await loadImageFromUrl(url);
      } catch {
        /* missing asset */
      }
    }),
  );
  return map;
}

export function waitAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      n += 1;
      if (n >= count) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Allow React commit + Konva draw after flushSync. */
export async function waitForExportPaint(extraFrames = 8): Promise<void> {
  await waitAnimationFrames(extraFrames);
}
