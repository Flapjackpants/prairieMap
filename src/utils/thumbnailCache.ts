const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for thumbnail'));
    };
    img.src = url;
  });
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Thumbnail toBlob failed'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.75,
    );
  });
}

async function generateThumbnailUrl(file: File, maxWidth: number): Promise<string> {
  const img = await loadImageFromFile(file);
  const scale = Math.min(1, maxWidth / Math.max(img.naturalWidth, 1));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToBlobUrl(canvas);
}

/** Small JPEG preview URL for sidebar rack slots (keyed by filename). */
export function getThumbnailUrl(file: File, filename: string, maxWidth = 128): Promise<string> {
  const cached = cache.get(filename);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(filename);
  if (pending) return pending;

  const promise = generateThumbnailUrl(file, maxWidth).then((url) => {
    cache.set(filename, url);
    inflight.delete(filename);
    return url;
  });
  inflight.set(filename, promise);
  promise.catch(() => inflight.delete(filename));
  return promise;
}

export function revokeAllThumbnails(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
  inflight.clear();
}
