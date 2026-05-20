import { v4 as uuidv4 } from 'uuid';
import type {
  AssetFrameState,
  FileRegistryEntry,
  ProjectState,
  TimelineEntry,
} from '../types/project';
import { createEmptyAssetState } from '../types/project';
import { filterAndSortImageFiles } from './sortFiles';
import {
  createInitialAssetsFromFiles,
  createTimelineFromFiles,
} from './exportSchema';

export function buildFileRegistry(files: File[]): Record<string, FileRegistryEntry> {
  const registry: Record<string, FileRegistryEntry> = {};
  for (const file of files) {
    registry[file.name] = {
      file,
      objectUrl: URL.createObjectURL(file),
      canvasWidth: 1920,
      canvasHeight: 1080,
    };
  }
  return registry;
}

export function revokeFileRegistry(registry: Record<string, FileRegistryEntry>): void {
  for (const entry of Object.values(registry)) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
  }
}

/** Fresh project from folder only (no prior state). */
export function initProjectFromFolder(files: File[]): Pick<
  ProjectState,
  'assets' | 'timeline' | 'fileRegistry' | 'projectName'
> {
  const sorted = filterAndSortImageFiles(files);
  const filenames = sorted.map((f) => f.name);
  return {
    projectName: 'Untitled Campaign',
    assets: createInitialAssetsFromFiles(filenames),
    timeline: createTimelineFromFiles(filenames),
    fileRegistry: buildFileRegistry(sorted),
  };
}

/**
 * Merge a folder with existing project data (after JSON import or reload).
 * - New files in folder → empty copy 0 + append to timeline
 * - Existing assets/timeline preserved
 * - Missing files → timeline entries stay (UI shows placeholder)
 */
export function reconcileFolderWithProject(
  files: File[],
  existing: Pick<ProjectState, 'assets' | 'timeline' | 'projectName' | 'palette' | 'carryOverLabels'>,
): Pick<ProjectState, 'assets' | 'timeline' | 'fileRegistry'> {
  const sorted = filterAndSortImageFiles(files);
  const folderNames = new Set(sorted.map((f) => f.name));
  const registry = buildFileRegistry(sorted);

  const assets: Record<string, AssetFrameState[]> = { ...existing.assets };
  let timeline: TimelineEntry[] = existing.timeline.map((t) => ({ ...t }));

  for (const file of sorted) {
    if (!assets[file.name]) {
      assets[file.name] = [createEmptyAssetState()];
      timeline.push({
        id: uuidv4(),
        filename: file.name,
        copyIndex: 0,
      });
    }
  }

  // Timeline entries pointing at files not in folder are kept (missing asset UI)
  void folderNames;

  return { assets, timeline, fileRegistry: registry };
}
