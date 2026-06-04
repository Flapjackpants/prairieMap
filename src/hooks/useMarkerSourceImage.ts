import { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { isBlankAssetKey } from '../types/project';

export function useMarkerSourceImage(filename: string | null | undefined) {
  const { state } = useProject();
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!filename || isBlankAssetKey(filename)) {
      setImage(null);
      return;
    }
    const url = state.fileRegistry[filename]?.objectUrl;
    if (!url) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [filename, state.fileRegistry]);

  return image;
}
