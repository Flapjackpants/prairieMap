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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-frame-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-md neon-glow-cyan shadow-2xl">
        <div className="panel-header">
          <span className="led led-on" aria-hidden />
          <Copy className="h-3.5 w-3.5 text-accent-orange" />
          <h2 id="duplicate-frame-title" className="panel-title">
            [[ Frame_Duplicate ]]
          </h2>
          <button type="button" className="btn-icon ml-auto h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="border-b border-metal-shadow px-4 py-2 font-mono text-[10px] tracking-wider text-text-muted uppercase">
          Source: <span className="text-accent-cyan">{sourceLabel}</span>
        </p>

        <ul className="space-y-1 p-3">
          {OPTIONS.map(({ key, label, description, icon: Icon }) => {
            const checked = options[key];
            return (
              <li key={key}>
                <label
                  className={`flex cursor-pointer gap-3 border p-3 transition-all ${
                    checked
                      ? 'border-accent-orange/50 bg-accent-orange/5 neon-glow-orange'
                      : 'border-metal-shadow bg-surface hover:border-border-bright'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent-orange"
                    checked={checked}
                    onChange={() => toggle(key)}
                  />
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" />
                  <span>
                    <span className="block font-mono text-[10px] font-semibold tracking-wider text-text-primary uppercase">
                      {label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] leading-relaxed text-text-muted normal-case">
                      {description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {!options.duplicateMapImage && (
          <p className="mx-3 mb-2 border border-accent-orange/30 bg-accent-orange/5 px-2.5 py-2 font-mono text-[9px] tracking-wide text-accent-orange uppercase">
            Drawings route to next timeline map when image dup is off.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-metal-shadow px-4 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Abort
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5"
            onClick={() => onConfirm(options)}
          >
            <Copy className="h-3.5 w-3.5" />
            Execute
          </button>
        </div>
      </div>
    </div>
  );
}
