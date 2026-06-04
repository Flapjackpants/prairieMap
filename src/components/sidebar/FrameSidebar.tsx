import { AlertTriangle, Copy, Film, ImageIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import type { FrameDuplicateOptions } from '../../types/project';
import { displayFilename, resolveTimelineEntry } from '../../utils/projectHelpers';
import { DuplicateFrameModal } from './DuplicateFrameModal';

function frameCode(index: number, label: string): string {
  const slug = label.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 12).toUpperCase();
  return `${String(index + 1).padStart(2, '0')} // FRAME_${slug || 'MAP'}`;
}

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

      <div className="panel-inset panel-scroll p-2">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <ImageIcon className="h-10 w-10 text-border-bright opacity-50" />
            <p className="font-mono text-[10px] leading-relaxed tracking-widest text-text-muted uppercase">
              Load map folder to initialize diagnostic rack.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {timeline.map((entry, index) => {
              const resolved = resolveTimelineEntry(state, index)!;
              const isActive = index === currentTimelineIndex;
              const isDragging = dragIndex === index;
              const isDropTarget = dropTargetIndex === index && dragIndex !== index;
              const label = displayFilename(entry.filename);
              const copyLabel =
                (state.assets[entry.filename]?.length ?? 0) > 1
                  ? ` · CPY_${entry.copyIndex + 1}`
                  : '';

              return (
                <li
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  className={`transition-all ${isDragging ? 'opacity-50' : ''} ${
                    isDropTarget ? 'outline outline-1 outline-dashed outline-accent-cyan/50' : ''
                  }`}
                >
                  <div className={`group rack-slot ${isActive ? 'rack-slot-active' : ''}`}>
                    <div
                      className="grip-ridges flex w-3 shrink-0 cursor-grab items-stretch border-r border-metal-shadow active:cursor-grabbing"
                      title="Drag to reorder"
                    />

                    <button
                      type="button"
                      onClick={() => setTimelineIndex(index)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={`led ${isActive ? 'led-on' : ''}`}
                        aria-label={isActive ? 'Active frame' : 'Inactive frame'}
                      />

                      <div className="rack-thumb">
                        {resolved.isMissing ? (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-accent-crimson/10 px-0.5">
                            <AlertTriangle className="h-4 w-4 text-accent-orange" />
                            <span className="text-center font-mono text-[6px] leading-tight text-accent-orange uppercase">
                              ERR
                            </span>
                          </div>
                        ) : resolved.isBlank ? (
                          <div className="flex h-full w-full items-center justify-center bg-surface-overlay">
                            <ImageIcon className="h-5 w-5 text-border-bright opacity-60" />
                          </div>
                        ) : (
                          <img
                            src={resolved.objectUrl!}
                            alt={label}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        )}
                        <span className="absolute bottom-0 left-0 bg-surface/95 px-1 font-mono text-[9px] tabular-nums text-accent-cyan">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[10px] font-semibold tracking-wider text-text-primary uppercase">
                          {frameCode(index, label)}
                        </p>
                        <p className="truncate font-mono text-[9px] tracking-wide text-text-muted uppercase">
                          {label}
                          {copyLabel}
                          {resolved.isBlank && (
                            <span className="text-accent-orange"> · BLK</span>
                          )}
                          {resolved.isMissing && (
                            <span className="text-accent-orange"> · MIS</span>
                          )}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      title="Duplicate frame"
                      onClick={(e) => openDuplicateModal(index, e)}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:!text-accent-crimson focus:opacity-100"
                      title="Delete frame"
                      onClick={(e) => handleDelete(index, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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
