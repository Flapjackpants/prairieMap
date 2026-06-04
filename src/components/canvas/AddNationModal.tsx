import { Flag, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PaletteColor } from '../../types/project';
import { defaultHexForPalette, normalizeHexInput } from '../../utils/paletteColors';

interface AddNationModalProps {
  palette: PaletteColor[];
  onConfirm: (name: string, hex: string) => void;
  onClose: () => void;
}

export function AddNationModal({ palette, onConfirm, onClose }: AddNationModalProps) {
  const [name, setName] = useState('New Nation');
  const [hex, setHex] = useState(() => defaultHexForPalette(palette));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    const normalized = normalizeHexInput(hex);
    if (!trimmed || !normalized) return;
    onConfirm(trimmed, normalized);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-sm">
        <div className="panel-header">
          <Flag className="h-3.5 w-3.5 text-accent-orange" />
          <span className="panel-title">[[ Add_Nation ]]</span>
          <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Designation
            <input
              type="text"
              className="input-field mt-1"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
            />
          </label>
          <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
            Chroma
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                value={normalizeHexInput(hex) ?? '#448aff'}
                onChange={(e) => setHex(e.target.value)}
                className="h-9 w-11 cursor-pointer border border-metal-shadow bg-transparent"
              />
              <input
                type="text"
                className="input-field flex-1 normal-case"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
              />
            </div>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary flex items-center gap-1" onClick={handleConfirm}>
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
