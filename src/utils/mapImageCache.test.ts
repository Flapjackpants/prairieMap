import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquire,
  cacheOrder,
  cacheSize,
  getIfCached,
  releaseAll,
  touch,
} from './mapImageCache';

function makeFile(name: string): File {
  return new File(['pixels'], name, { type: 'image/png' });
}

describe('mapImageCache', () => {
  let urlSeq = 0;
  const created = new Set<string>();
  const revoked = new Set<string>();

  beforeEach(() => {
    urlSeq = 0;
    created.clear();
    revoked.clear();
    releaseAll();
    vi.stubGlobal('URL', {
      createObjectURL: () => {
        const url = `blob:mock-${++urlSeq}`;
        created.add(url);
        return url;
      },
      revokeObjectURL: (url: string) => {
        revoked.add(url);
      },
    });
  });

  afterEach(() => {
    releaseAll();
    vi.unstubAllGlobals();
  });

  it('reuses cached URL for the same filename', () => {
    const file = makeFile('a.png');
    const first = acquire('a.png', file);
    const second = acquire('a.png', file);
    expect(second).toBe(first);
    expect(cacheSize()).toBe(1);
    expect(created.size).toBe(1);
  });

  it('evicts least-recently used entry when exceeding MAX_CACHED', () => {
    const files = Array.from({ length: 9 }, (_, i) => makeFile(`f${i}.png`));
    const oldestUrl = acquire('f0.png', files[0]);
    for (let i = 1; i < 8; i++) {
      acquire(`f${i}.png`, files[i]);
    }
    expect(cacheSize()).toBe(8);
    acquire('f8.png', files[8]);
    expect(cacheSize()).toBe(8);
    expect(getIfCached('f0.png')).toBeNull();
    expect(getIfCached('f8.png')).not.toBeNull();
    expect(revoked.has(oldestUrl)).toBe(true);
  });

  it('touch keeps an entry during eviction', () => {
    const files = Array.from({ length: 9 }, (_, i) => makeFile(`g${i}.png`));
    for (let i = 0; i < 8; i++) {
      acquire(`g${i}.png`, files[i]);
    }
    touch('g0.png');
    acquire('g8.png', files[8]);
    expect(getIfCached('g0.png')).not.toBeNull();
    expect(getIfCached('g1.png')).toBeNull();
    expect(cacheOrder()).toContain('g8.png');
  });
});
