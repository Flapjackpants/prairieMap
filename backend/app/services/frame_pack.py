import struct
from pathlib import Path

from fastapi import HTTPException, UploadFile

PACK_MAGIC = b"PMFP"
PACK_VERSION = 1


def _suffix_for_image(data: bytes) -> str:
    if data.startswith(b"\xff\xd8"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    return ".jpg"


async def unpack_frame_pack(upload: UploadFile, dest_dir: Path) -> list[Path]:
    data = await upload.read()
    if len(data) < 8:
        raise HTTPException(status_code=400, detail="Invalid frame pack (too small)")

    magic = data[:4]
    if magic != PACK_MAGIC:
        raise HTTPException(status_code=400, detail="Invalid frame pack header")

    version = struct.unpack_from("<I", data, 4)[0]
    if version != PACK_VERSION:
        raise HTTPException(status_code=400, detail=f"Unsupported frame pack version: {version}")

    count = struct.unpack_from("<I", data, 8)[0]
    if count == 0:
        raise HTTPException(status_code=400, detail="Frame pack contains no frames")

    offset = 12
    paths: list[Path] = []
    for i in range(count):
        if offset + 4 > len(data):
            raise HTTPException(status_code=400, detail="Truncated frame pack")
        length = struct.unpack_from("<I", data, offset)[0]
        offset += 4
        if length == 0:
            raise HTTPException(status_code=400, detail=f"Frame {i} is empty")
        if offset + length > len(data):
            raise HTTPException(status_code=400, detail="Truncated frame data")
        frame_bytes = data[offset : offset + length]
        offset += length
        suffix = _suffix_for_image(frame_bytes)
        dest = dest_dir / f"frame_{i:04d}{suffix}"
        dest.write_bytes(frame_bytes)
        paths.append(dest)
    return paths
