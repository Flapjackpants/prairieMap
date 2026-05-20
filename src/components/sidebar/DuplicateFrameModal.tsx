import { Copy, Image, Layers, ScrollText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DEFAULT_DUPLICATE_OPTIONS,
  type FrameDuplicateOptions,
} from '../../types/project';

interface DuplicateFrameModalProps {
  sourceLabel: string;
  onConfirm: (options: FrameDuplicateOptions) => void;
  onClose: () => void;
}

const OPTIONS: {
  key: keyof FrameDuplicateOptions;
  label: string;
  description: string;
  icon: typeof Image;
}[] = [
  {
    key: 'duplicateMapImage',
    label: 'Duplicate map image',
    description:
      'Keep the same map. When off, drawings and labels apply to the next map in the timeline.',
    icon: Image,
  },
  {
    key: 'duplicateAnnotations',
    label: 'Duplicate territories & labels',
    description: 'Copy country regions and auto-fitted labels as independent data.',
    icon: Layers,
  },
  {
    key: 'duplicateInfoBoard',
    label: 'Duplicate info board',
    description: 'Copy date, markdown notes, and faction stats.',
    icon: ScrollText,
  },
];

export function DuplicateFrameModal({
  sourceLabel,
  onConfirm,
  onClose,
}: DuplicateFrameModalProps) {
  const [options, setOptions] = useState<FrameDuplicateOptions>({
    ...DEFAULT_DUPLICATE_OPTIONS,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key: keyof FrameDuplicateOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-frame-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-raised shadow-2xl neon-glow">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-accent-cyan" />
            <h2 id="duplicate-frame-title" className="text-sm font-bold tracking-wide uppercase">
              Duplicate Frame
            </h2>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="border-b border-border px-4 py-2 font-mono text-xs text-text-muted">
          Source: <span className="text-accent-cyan">{sourceLabel}</span>
        </p>

        <ul className="space-y-1 p-3">
          {OPTIONS.map(({ key, label, description, icon: Icon }) => {
            const checked = options[key];
            return (
              <li key={key}>
                <label
                  className={`flex cursor-pointer gap-3 rounded border p-3 transition-colors ${
                    checked
                      ? 'border-accent-cyan/40 bg-accent-cyan/5'
                      : 'border-border bg-surface hover:border-border-bright'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent-cyan"
                    checked={checked}
                    onChange={() => toggle(key)}
                  />
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{label}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {!options.duplicateMapImage && (
          <p className="mx-3 mb-2 rounded border border-accent-amber/30 bg-accent-amber/5 px-2.5 py-2 text-xs text-accent-amber">
            Drawings and labels will be placed on the next map in the timeline (the following
            frame, or the next file in your folder if this is the last frame).
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className="rounded border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text-primary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5"
            onClick={() => onConfirm(options)}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}
