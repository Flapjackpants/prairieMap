import type {
  AssetFrameState,
  FileRegistryEntry,
  ProjectState,
  ResolvedFrame,
  TimelineEntry,
} from '../types/project';
import {
  BLANK_ASSET_PREFIX,
  createEmptyAssetState,
  DEFAULT_CANVAS_SIZE,
  isBlankAssetKey,
} from '../types/project';

export function getAssetState(
  assets: Record<string, AssetFrameState[]>,
  filename: string,
  copyIndex: number,
): AssetFrameState {
  const copies = assets[filename];
  if (!copies?.[copyIndex]) {
    return createEmptyAssetState();
  }
  return copies[copyIndex];
}

export function ensureAssetSlot(
  assets: Record<string, AssetFrameState[]>,
  filename: string,
  copyIndex: number,
): AssetFrameState {
  if (!assets[filename]) assets[filename] = [];
  while (assets[filename].length <= copyIndex) {
    assets[filename].push(createEmptyAssetState());
  }
  if (!assets[filename][copyIndex]) {
    assets[filename][copyIndex] = createEmptyAssetState();
  }
  return assets[filename][copyIndex];
}

export function resolveTimelineEntry(
  state: ProjectState,
  timelineIndex: number,
): ResolvedFrame | null {
  const entry = state.timeline[timelineIndex];
  if (!entry) return null;

  const isBlank = isBlankAssetKey(entry.filename);
  const registry = isBlank ? null : state.fileRegistry[entry.filename];
  const isMissing = !isBlank && !registry;

  const registryEntry: FileRegistryEntry = registry ?? {
    file: null,
    objectUrl: null,
    canvasWidth: DEFAULT_CANVAS_SIZE.width,
    canvasHeight: DEFAULT_CANVAS_SIZE.height,
  };

  return {
    timelineIndex,
    entry,
    filename: entry.filename,
    copyIndex: entry.copyIndex,
    isMissing,
    isBlank,
    objectUrl: registryEntry.objectUrl,
    file: registryEntry.file,
    canvasWidth: registryEntry.canvasWidth,
    canvasHeight: registryEntry.canvasHeight,
    frameData: getAssetState(state.assets, entry.filename, entry.copyIndex),
  };
}

export function resolveCurrentFrame(state: ProjectState): ResolvedFrame | null {
  if (state.timeline.length === 0) return null;
  const index = Math.max(
    0,
    Math.min(state.currentTimelineIndex, state.timeline.length - 1),
  );
  return resolveTimelineEntry(state, index);
}

/** Remove unreferenced copy indices and remap timeline copyIndex values per filename. */
export function cleanupAssetCopies(
  assets: Record<string, AssetFrameState[]>,
  timeline: TimelineEntry[],
): {
  assets: Record<string, AssetFrameState[]>;
  timeline: TimelineEntry[];
} {
  const nextAssets: Record<string, AssetFrameState[]> = { ...assets };
  let nextTimeline = [...timeline];

  const filenames = new Set([
    ...Object.keys(nextAssets),
    ...nextTimeline.map((t) => t.filename),
  ]);

  for (const filename of filenames) {
    const referenced = [
      ...new Set(
        nextTimeline.filter((t) => t.filename === filename).map((t) => t.copyIndex),
      ),
    ].sort((a, b) => a - b);

    if (referenced.length === 0) {
      delete nextAssets[filename];
      continue;
    }

    const oldCopies = nextAssets[filename] ?? [];
    const newCopies: AssetFrameState[] = [];
    const indexMap = new Map<number, number>();

    for (const oldIdx of referenced) {
      if (oldCopies[oldIdx]) {
        indexMap.set(oldIdx, newCopies.length);
        newCopies.push(oldCopies[oldIdx]);
      } else {
        indexMap.set(oldIdx, newCopies.length);
        newCopies.push(createEmptyAssetState());
      }
    }

    nextAssets[filename] = newCopies;
    nextTimeline = nextTimeline.map((t) =>
      t.filename === filename && indexMap.has(t.copyIndex)
        ? { ...t, copyIndex: indexMap.get(t.copyIndex)! }
        : t,
    );
  }

  return { assets: nextAssets, timeline: nextTimeline };
}

export function displayFilename(filename: string): string {
  if (filename.startsWith(BLANK_ASSET_PREFIX)) {
    return filename.slice(BLANK_ASSET_PREFIX.length);
  }
  return filename;
}

export function clampTimelineIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

/**
 * Filename of the next map after `sourceIndex`: the following timeline entry's
 * image, or the next file in the loaded folder (alphanumeric) when at end of timeline.
 */
export function getNextMapFilename(
  timeline: TimelineEntry[],
  fileRegistry: Record<string, FileRegistryEntry>,
  sourceIndex: number,
): string | null {
  for (let i = sourceIndex + 1; i < timeline.length; i++) {
    const filename = timeline[i].filename;
    if (!isBlankAssetKey(filename)) return filename;
  }

  const sourceEntry = timeline[sourceIndex];
  if (!sourceEntry) return null;

  const sourceName = isBlankAssetKey(sourceEntry.filename)
    ? displayFilename(sourceEntry.filename)
    : sourceEntry.filename;

  const files = Object.keys(fileRegistry).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );

  const fileIdx = files.indexOf(sourceName);
  if (fileIdx >= 0 && fileIdx < files.length - 1) {
    return files[fileIdx + 1];
  }

  return null;
}
