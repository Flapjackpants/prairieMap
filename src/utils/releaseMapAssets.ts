import { releaseAll as releaseMapImages } from './mapImageCache';
import { revokeAllThumbnails } from './thumbnailCache';
import type { FileRegistryEntry } from '../types/project';

export function releaseAllMapAssets(registry: Record<string, FileRegistryEntry>): void {
  for (const entry of Object.values(registry)) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  }
  releaseMapImages();
  revokeAllThumbnails();
}
