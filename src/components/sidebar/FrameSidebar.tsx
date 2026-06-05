import { useVirtualizer } from '@tanstack/react-virtual';
import { Copy, Film, ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import type { FrameDuplicateOptions } from '../../types/project';
import { isBlankAssetKey } from '../../types/project';
import { displayFilename, resolveTimelineEntry } from '../../utils/projectHelpers';
import { DuplicateFrameModal } from './DuplicateFrameModal';
import { FrameRackRow, RACK_ROW_GAP, RACK_ROW_HEIGHT } from './FrameRackRow';

export function FrameSidebar() {
  const {
    state,
    currentFrame,
    setTimelineIndex,
    reorderTimeline,
    deleteFrame,
    duplicateFrame,
  } = useProject();
  const { timeline, currentTimelineIndex, fileRegistry } = state;
  const [duplicateSourceIndex, setDuplicateSourceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: timeline.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RACK_ROW_HEIGHT + RACK_ROW_GAP,
    overscan: 4,
  });

  useEffect(() => {
    if (timeline.length === 0) return;
    virtualizer.scrollToIndex(currentTimelineIndex, { align: 'auto' });
  }, [currentTimelineIndex, timeline.length, virtualizer]);

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
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="panel-header">
        <span className="led led-on" aria-hidden />
        <span className="panel-bracket">[[</span>
        <Film className="h-3.5 w-3.5 text-accent-orange" />
        <span className="panel-title">Timeline_Control</span>
        <span className="panel-bracket">]]</span>
        <span className="ml-auto font-mono text-[10px] tracking-widest text-accent-cyan tabular-nums">
          {timeline.length > 0
            ? `${String(currentTimelineIndex + 1).padStart(2, '0')}/${String(timeline.length).padStart(2, '0')}`
            : '—/—'}
        </span>
        {timeline.length > 0 && (
          <button
            type="button"
            className="btn-icon ml-1 h-7 w-7"
            title="Duplicate current frame"
            onClick={(e) => openDuplicateModal(currentTimelineIndex, e)}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="panel-inset panel-scroll min-h-0 flex-1 p-2">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <ImageIcon className="h-10 w-10 text-border-bright opacity-50" />
            <p className="font-mono text-[10px] leading-relaxed tracking-widest text-text-muted uppercase">
              Load map folder to initialize diagnostic rack.
            </p>
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index;
              const entry = timeline[index]!;
              const resolved = resolveTimelineEntry(state, index)!;
              const registry = isBlankAssetKey(entry.filename)
                ? null
                : fileRegistry[entry.filename];

              return (
                <div
                  key={entry.id}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <FrameRackRow
                    index={index}
                    entry={entry}
                    isActive={index === currentTimelineIndex}
                    isDragging={dragIndex === index}
                    isDropTarget={dropTargetIndex === index && dragIndex !== index}
                    isBlank={resolved.isBlank}
                    isMissing={resolved.isMissing}
                    file={registry?.file ?? null}
                    copyCount={state.assets[entry.filename]?.length ?? 0}
                    onSelect={() => setTimelineIndex(index)}
                    onDuplicate={(e) => openDuplicateModal(index, e)}
                    onDelete={(e) => handleDelete(index, e)}
                    onDragStart={(e) => handleDragStart(index, e)}
                    onDragOver={(e) => handleDragOver(index, e)}
                    onDrop={(e) => handleDrop(index, e)}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {currentFrame && (
        <div className="border-t border-metal-shadow bg-surface px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="led led-on" aria-hidden />
            <p className="font-mono text-[9px] tracking-widest text-accent-orange uppercase">Active_Slot</p>
          </div>
          <p className="truncate font-mono text-[10px] tracking-wide text-accent-cyan uppercase">
            {displayFilename(currentFrame.filename)}
            {currentFrame.isMissing && ' · ERR_MISSING'}
          </p>
        </div>
      )}

      {duplicateSource && duplicateSourceIndex !== null && (
        <DuplicateFrameModal
          sourceLabel={`${String(duplicateSourceIndex + 1).padStart(2, '0')} // ${displayFilename(duplicateSource.filename)}${duplicateResolved && (state.assets[duplicateSource.filename]?.length ?? 0) > 1 ? ` · CPY_${duplicateSource.copyIndex + 1}` : ''}`}
          onConfirm={handleDuplicateConfirm}
          onClose={() => setDuplicateSourceIndex(null)}
        />
      )}
    </aside>
  );
}
