import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getThumbnailUrl, revokeAllThumbnails } from './thumbnailCache';

function makeFile(name: string): File {
  return new File(['pixels'], name, { type: 'image/png' });
}

describe('thumbnailCache', () => {
  beforeEach(() => {
    revokeAllThumbnails();
    let blobSeq = 0;
    vi.stubGlobal('URL', {
      createObjectURL: () => `blob:thumb-${++blobSeq}`,
      revokeObjectURL: vi.fn(),
    });

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 200;
      naturalHeight = 100;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected tag: ${tag}`);
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (cb: (b: Blob | null) => void) => {
            cb(new Blob(['jpeg'], { type: 'image/jpeg' }));
          },
        };
      },
    });
  });

  afterEach(() => {
    revokeAllThumbnails();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('deduplicates in-flight thumbnail generation per filename', async () => {
    const file = makeFile('map.png');
    const p1 = getThumbnailUrl(file, 'map.png');
    const p2 = getThumbnailUrl(file, 'map.png');
    expect(p1).toBe(p2);
    const [u1, u2] = await Promise.all([p1, p2]);
    expect(u1).toBe(u2);
    expect(u1).toMatch(/^blob:thumb-/);
  });

  it('returns cached URL on subsequent calls', async () => {
    const file = makeFile('cached.png');
    const first = await getThumbnailUrl(file, 'cached.png');
    const second = await getThumbnailUrl(file, 'cached.png');
    expect(second).toBe(first);
  });
});
