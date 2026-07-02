import { describe, expect, it } from 'vitest';
import { FRAME_PACK_MAGIC, FRAME_PACK_VERSION, packFrames } from './framePack';

describe('packFrames', () => {
  it('builds a PMFP blob with length-prefixed frames', async () => {
    const frames = [
      new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 3])]),
      new Blob([new Uint8Array([0xff, 0xd8, 4, 5])]),
    ];
    const packed = await packFrames(frames);
    const bytes = new Uint8Array(await packed.arrayBuffer());

    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe(FRAME_PACK_MAGIC);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(4, true)).toBe(FRAME_PACK_VERSION);
    expect(view.getUint32(8, true)).toBe(2);
    expect(view.getUint32(12, true)).toBe(5);
    expect(bytes[16]).toBe(0xff);
    expect(view.getUint32(21, true)).toBe(4);
    expect(bytes[25]).toBe(0xff);
  });
});
