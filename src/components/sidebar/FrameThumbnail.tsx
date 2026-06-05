import { AlertTriangle, ImageIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getThumbnailUrl } from '../../utils/thumbnailCache';

interface FrameThumbnailProps {
  filename: string;
  file: File | null;
  isBlank: boolean;
  isMissing: boolean;
  index: number;
}

export function FrameThumbnail({ filename, file, isBlank, isMissing, index }: FrameThumbnailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { root: el.closest('.panel-scroll'), rootMargin: '200px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || isMissing || isBlank || !file) {
      setThumbUrl(null);
      return;
    }
    let cancelled = false;
    void getThumbnailUrl(file, filename).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, file, filename, isMissing, isBlank]);

  return (
    <div ref={rootRef} className="rack-thumb">
      {isMissing ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-accent-crimson/10 px-0.5">
          <AlertTriangle className="h-4 w-4 text-accent-orange" />
          <span className="text-center font-mono text-[6px] leading-tight text-accent-orange uppercase">
            ERR
          </span>
        </div>
      ) : isBlank ? (
        <div className="flex h-full w-full items-center justify-center bg-surface-overlay">
          <ImageIcon className="h-5 w-5 text-border-bright opacity-60" />
        </div>
      ) : thumbUrl ? (
        <img src={thumbUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-overlay">
          <ImageIcon className="h-5 w-5 text-border-bright opacity-40" />
        </div>
      )}
      <span className="absolute bottom-0 left-0 bg-surface/95 px-1 font-mono text-[9px] tabular-nums text-accent-cyan">
        {String(index + 1).padStart(2, '0')}
      </span>
    </div>
  );
}
