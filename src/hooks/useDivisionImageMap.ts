import { useEffect, useMemo, useState } from 'react';
import type { DivisionMarker, FileRegistryEntry } from '../types/project';
import { isBlankAssetKey } from '../types/project';
import { acquireMapImageUrl } from './useMapImageUrl';
import { loadImageFromUrl } from '../utils/exportCapture';

export function useDivisionImageMap(
  divisions: DivisionMarker[],
  fileRegistry: Record<string, FileRegistryEntry>,
): Record<string, HTMLImageElement> {
  const filenames = useMemo(
    () => [
      ...new Set(
        divisions
          .map((d) => d.sourceFilename)
          .filter((f) => f && !isBlankAssetKey(f)),
      ),
    ],
    [divisions],
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
