import { MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CityNameModalProps {
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function CityNameModal({ onConfirm, onClose }: CityNameModalProps) {
  const [name, setName] = useState('City');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
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
          <MapPin className="h-3.5 w-3.5 text-accent-cyan" />
          <span className="panel-title">[[ Place_City ]]</span>
          <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block font-mono text-[9px] tracking-widest text-text-muted uppercase">
            City name
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
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>
              Place
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
