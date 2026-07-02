import asyncio
import struct
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.services.frame_pack import PACK_MAGIC, PACK_VERSION, unpack_frame_pack


class _FakeUpload:
    def __init__(self, data: bytes):
        self._data = data

    async def read(self) -> bytes:
        return self._data


def _build_pack(frames: list[bytes]) -> bytes:
    out = bytearray(PACK_MAGIC)
    out.extend(struct.pack("<I", PACK_VERSION))
    out.extend(struct.pack("<I", len(frames)))
    for frame in frames:
        out.extend(struct.pack("<I", len(frame)))
        out.extend(frame)
    return bytes(out)


def test_unpack_frame_pack(tmp_path: Path):
    frames = [b"\xff\xd8fake1", b"\xff\xd8fake2", b"\x89PNG\r\n\x1a\nfake"]
    paths = asyncio.run(unpack_frame_pack(_FakeUpload(_build_pack(frames)), tmp_path))
    assert len(paths) == 3
    assert paths[0].suffix == ".jpg"
    assert paths[2].suffix == ".png"
    assert paths[0].read_bytes() == frames[0]


def test_unpack_rejects_bad_magic(tmp_path: Path):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(unpack_frame_pack(_FakeUpload(b"BAD!"), tmp_path))
    assert exc.value.status_code == 400
