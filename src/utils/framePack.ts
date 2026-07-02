/** PrairieMap frame pack — single binary blob instead of thousands of multipart files. */
export const FRAME_PACK_MAGIC = 'PMFP';
export const FRAME_PACK_VERSION = 1;

export async function packFrames(frames: Blob[]): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('At least one frame is required');
  }

  const buffers = await Promise.all(frames.map((frame) => frame.arrayBuffer()));
  const headerBytes = 12 + buffers.length * 4;
  const totalBytes = headerBytes + buffers.reduce((sum, buf) => sum + buf.byteLength, 0);

  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);

  out.set([0x50, 0x4d, 0x46, 0x50], 0); // PMFP
  view.setUint32(4, FRAME_PACK_VERSION, true);
  view.setUint32(8, buffers.length, true);

  let offset = 12;
  for (const buf of buffers) {
    view.setUint32(offset, buf.byteLength, true);
    offset += 4;
    out.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return new Blob([out], { type: 'application/octet-stream' });
}
