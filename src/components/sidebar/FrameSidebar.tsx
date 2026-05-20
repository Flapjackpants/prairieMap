import { AlertTriangle, Copy, Film, GripVertical, ImageIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import type { FrameDuplicateOptions } from '../../types/project';
import { displayFilename, resolveTimelineEntry } from '../../utils/projectHelpers';
import { DuplicateFrameModal } from './DuplicateFrameModal';

export function FrameSidebar() {
  const {
    state,
    currentFrame,
    setTimelineIndex,
    reorderTimeline,
    deleteFrame,
    duplicateFrame,
  } = useProject();
  const { timeline, currentTimelineIndex } = state;
  const [duplicateSourceIndex, setDuplicateSourceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const openDuplicateModal = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicateSourceIndex(index);
  };

  const handleDuplicateConfirm = (options: FrameDuplicateOptions) => {
    if (duplicateSourceIndex === null) return;
    const ok = duplicateFrame(duplicateSourceIndex, options);
    if (!ok) {
      alert(
        'No next map is available. Add another frame after this one in the timeline, or enable "Duplicate map image".',
      );
      return;
    }
    setDuplicateSourceIndex(null);
  };

  const handleDelete = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeline.length <= 1) {
      if (!confirm('Delete the only remaining frame?')) return;
    } else if (!confirm('Delete this frame from the timeline?')) {
      return;
    }
    deleteFrame(index);
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-prairiemap-index', String(index));
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  };

  const handleDrop = (toIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-prairiemap-index');
    const fromIndex = dragIndex ?? (raw !== '' ? Number(raw) : NaN);
    if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderTimeline(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const duplicateSource =
    duplicateSourceIndex !== null ? timeline[duplicateSourceIndex] : null;
  const duplicateResolved =
    duplicateSourceIndex !== null
      ? resolveTimelineEntry(state, duplicateSourceIndex)
      : null;

  return (
    <aside className="panel border-r-0 border-l-0">
      <div className="panel-header">
        <Film className="h-4 w-4 text-accent-cyan" />
        <span className="text-sm font-semibold tracking-wide uppercase">Timeline</span>
        <span className="ml-auto font-mono text-xs text-text-muted">
          {timeline.length > 0 ? `${currentTimelineIndex + 1}/${timeline.length}` : '—'}
        </span>
        {timeline.length > 0 && (
          <button
            type="button"
            className="btn-icon ml-1"
            title="Duplicate current frame"
            onClick={(e) => openDuplicateModal(currentTimelineIndex, e)}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <ImageIcon className="h-10 w-10 text-border-bright" />
            <p className="text-sm text-text-muted">
              Load a folder of map images to begin your chronology.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {timeline.map((entry, index) => {
              const resolved = resolveTimelineEntry(state, index)!;
              const isActive = index === currentTimelineIndex;
              const isDragging = dragIndex === index;
              const isDropTarget = dropTargetIndex === index && dragIndex !== index;
              const label = displayFilename(entry.filename);
              const copyLabel =
                (state.assets[entry.filename]?.length ?? 0) > 1
                  ? ` · copy ${entry.copyIndex + 1}`
                  : '';

              return (
                <li
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  className={`rounded border transition-all ${
                    isDropTarget ? 'border-accent-cyan/60 border-dashed' : 'border-transparent'
                  } ${isDragging ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`group flex w-full items-center gap-0.5 rounded border p-1 ${
                      isActive
                        ? 'border-accent-cyan/50 bg-accent-cyan/10 neon-glow'
                        : 'border-transparent hover:border-border hover:bg-surface-overlay'
                    }`}
                  >
                    <div
                      className="flex shrink-0 cursor-grab items-center px-0.5 text-text-muted active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setTimelineIndex(index)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded border border-border bg-surface">
                        {resolved.isMissing ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-accent-crimson/10 px-0.5">
                            <AlertTriangle className="h-4 w-4 text-accent-crimson" />
                            <span className="text-center font-mono text-[7px] leading-tight text-accent-crimson">
                              MISSING
                            </span>
                          </div>
                        ) : resolved.isBlank ? (
                          <div className="flex h-full w-full items-center justify-center bg-surface-overlay">
                            <ImageIcon className="h-5 w-5 text-border-bright" />
                          </div>
                        ) : (
                          <img
                            src={resolved.objectUrl!}
                            alt={label}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        )}
                        <span className="absolute bottom-0 left-0 bg-surface/90 px-1 font-mono text-[10px] text-accent-cyan">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text-primary">
                          Frame {index + 1}
                          {resolved.isBlank && (
                            <span className="ml-1 font-normal text-accent-amber">· blank</span>
                          )}
                          {resolved.isMissing && (
                            <span className="ml-1 font-normal text-accent-crimson">· missing</span>
                          )}
                        </p>
                        <p className="truncate font-mono text-[10px] text-text-muted">
                          {label}
                          {copyLabel}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-cyan/50 hover:text-accent-cyan focus:opacity-100"
                      title="Duplicate frame"
                      onClick={(e) => openDuplicateModal(index, e)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-crimson/60 hover:bg-accent-crimson/10 hover:text-accent-crimson focus:opacity-100"
                      title="Delete frame"
                      onClick={(e) => handleDelete(index, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {currentFrame && (
        <div className="border-t border-border px-3 py-2">
          <p className="truncate font-mono text-[10px] text-text-muted">ACTIVE</p>
          <p className="truncate text-xs font-medium text-accent-cyan">
            {displayFilename(currentFrame.filename)}
            {currentFrame.isMissing && ' (missing asset)'}
          </p>
        </div>
      )}

      {duplicateSource && duplicateSourceIndex !== null && (
        <DuplicateFrameModal
          sourceLabel={`Frame ${duplicateSourceIndex + 1} — ${displayFilename(duplicateSource.filename)}${duplicateResolved && (state.assets[duplicateSource.filename]?.length ?? 0) > 1 ? ` (copy ${duplicateSource.copyIndex + 1})` : ''}`}
          onConfirm={handleDuplicateConfirm}
          onClose={() => setDuplicateSourceIndex(null)}
        />
      )}
    </aside>
  );
}
