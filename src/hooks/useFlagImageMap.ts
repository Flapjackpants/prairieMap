import { useEffect, useMemo, useState } from 'react';
import type { FileRegistryEntry, PaletteColor } from '../types/project';
import { isBlankAssetKey } from '../types/project';
import { acquireMapImageUrl } from './useMapImageUrl';
import { loadImageFromUrl } from '../utils/exportCapture';

export function useFlagImageMap(
  palette: PaletteColor[],
  fileRegistry: Record<string, FileRegistryEntry>,
): Record<string, HTMLImageElement> {
  const filenames = useMemo(
    () => [
      ...new Set(
        palette
          .map((p) => p.flagFilename)
          .filter((f): f is string => Boolean(f && !isBlankAssetKey(f))),
      ),
    ],
    [palette],
  );

  const filenamesKey = filenames.join('\0');
  const [imageMap, setImageMap] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    if (filenames.length === 0) {
      setImageMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, HTMLImageElement> = {};
      await Promise.all(
        filenames.map(async (filename) => {
          const file = fileRegistry[filename]?.file;
          if (!file) return;
          try {
            next[filename] = await loadImageFromUrl(acquireMapImageUrl(filename, file));
          } catch {
            /* missing asset */
          }
        }),
      );
      if (!cancelled) setImageMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [filenamesKey, fileRegistry]);

  return imageMap;
}

export function flagImageForFaction(
  palette: PaletteColor[],
  flagImageMap: Record<string, HTMLImageElement>,
  factionId: string,
): HTMLImageElement | null {
  const entry = palette.find((p) => p.id === factionId);
  if (!entry?.flagFilename) return null;
  return flagImageMap[entry.flagFilename] ?? null;
}
