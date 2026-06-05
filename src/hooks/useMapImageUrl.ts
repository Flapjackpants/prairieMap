import { useEffect, useState } from 'react';
import * as mapImageCache from '../utils/mapImageCache';

export function useMapImageUrl(
  filename: string | null,
  file: File | null,
  enabled: boolean,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !filename || !file) {
      setUrl(null);
      return;
    }
    const objectUrl = mapImageCache.acquire(filename, file);
    mapImageCache.touch(filename);
    setUrl(objectUrl);
  }, [filename, file, enabled]);

  return url;
}

export function acquireMapImageUrl(filename: string, file: File): string {
  return mapImageCache.acquire(filename, file);
}
