import { Flag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMapImageUrl } from '../../hooks/useMapImageUrl';
import { useProject } from '../../context/ProjectContext';
import { displayFilename } from '../../utils/projectHelpers';
import { isBlankAssetKey } from '../../types/project';
import type { PaletteColor } from '../../types/project';

interface FlagPickerModalProps {
  faction: PaletteColor;
  onClose: () => void;
}

function FlagPreview({ filename, file }: { filename: string; file: File | null }) {
  const url = useMapImageUrl(filename, file, Boolean(file));
  if (!url) {
    return <div className="h-12 w-16 border border-border bg-surface-raised" />;
  }
  return (
    <img
      src={url}
      alt=""
      className="h-12 w-16 border border-border object-contain bg-surface-raised"
    />
  );
}

export function FlagPickerModal({ faction, onClose }: FlagPickerModalProps) {
  const { state, updateFactionMetadata } = useProject();
  const filenames = Object.keys(state.fileRegistry).filter((f) => !isBlankAssetKey(f));
  const [selected, setSelected] = useState(faction.flagFilename ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    void updateFactionMetadata(faction.id, {
      flagFilename: selected || null,
    }).then(onClose);
  };

  const handleClear = () => {
    void updateFactionMetadata(faction.id, { flagFilename: null }).then(onClose);
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
      <div className="panel w-full max-w-md">
        <div className="panel-header">
          <Flag className="h-3.5 w-3.5 text-accent-orange" />
          <span className="panel-title">[[ Flag — {faction.name} ]]</span>
          <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto p-4">
          {filenames.length === 0 ? (
            <p className="font-mono text-xs text-text-muted">Load a map folder with images first.</p>
          ) : (
            filenames.map((filename) => {
              const file = state.fileRegistry[filename]?.file ?? null;
              const isSelected = selected === filename;
              return (
                <button
                  key={filename}
                  type="button"
                  onClick={() => setSelected(filename)}
                  className={`flex w-full items-center gap-3 border px-2 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-cyan bg-accent-cyan/10'
                      : 'border-border hover:border-border-bright'
                  }`}
                >
                  <FlagPreview filename={filename} file={file} />
                  <span className="font-mono text-xs text-text-primary">
                    {displayFilename(filename)}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" className="btn-secondary" onClick={handleClear}>
            Clear flag
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={filenames.length === 0}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
