import { Copy, Trash2 } from 'lucide-react';
import type { TimelineEntry } from '../../types/project';
import { displayFilename } from '../../utils/projectHelpers';
import { FrameThumbnail } from './FrameThumbnail';

export const RACK_ROW_HEIGHT = 56;
export const RACK_ROW_GAP = 6;

function frameCode(index: number, label: string): string {
  const slug = label.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 12).toUpperCase();
  return `${String(index + 1).padStart(2, '0')} // FRAME_${slug || 'MAP'}`;
}

export interface FrameRackRowProps {
  index: number;
  entry: TimelineEntry;
  isActive: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  isBlank: boolean;
  isMissing: boolean;
  file: File | null;
  copyCount: number;
  onSelect: () => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export function FrameRackRow({
  index,
  entry,
  isActive,
  isDragging,
  isDropTarget,
  isBlank,
  isMissing,
  file,
  copyCount,
  onSelect,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: FrameRackRowProps) {
  const label = displayFilename(entry.filename);
  const copyLabel = copyCount > 1 ? ` · CPY_${entry.copyIndex + 1}` : '';

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
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
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={`led ${isActive ? 'led-on' : ''}`}
            aria-label={isActive ? 'Active frame' : 'Inactive frame'}
          />

          <FrameThumbnail
            filename={entry.filename}
            file={file}
            isBlank={isBlank}
            isMissing={isMissing}
            index={index}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] font-semibold tracking-wider text-text-primary uppercase">
              {frameCode(index, label)}
            </p>
            <p className="truncate font-mono text-[9px] tracking-wide text-text-muted uppercase">
              {label}
              {copyLabel}
              {isBlank && <span className="text-accent-orange"> · BLK</span>}
              {isMissing && <span className="text-accent-orange"> · MIS</span>}
            </p>
          </div>
        </button>

        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          title="Duplicate frame"
          onClick={onDuplicate}
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:!text-accent-crimson focus:opacity-100"
          title="Delete frame"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}
