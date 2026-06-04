import tempfile
from pathlib import Path

import pytest

from app.services.video import _find_ffmpeg, compile_frames_to_mp4

pytestmark = pytest.mark.skipif(
    _find_ffmpeg() is None,
    reason="ffmpeg not installed",
)


def _write_png(path: Path, size: int = 32) -> None:
    """Minimal valid PNG (single color)."""
    import struct
    import zlib

    width = height = size
    raw = b""
    for y in range(height):
        raw += b"\x00"
        for x in range(width):
            raw += bytes([x * 8 % 256, y * 8 % 256, 128, 255])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def test_variable_frame_durations_compile():
    import shutil
    import subprocess

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        paths = []
        for i in range(3):
            p = tmp_path / f"frame_{i:04d}.png"
            _write_png(p)
            paths.append(p)
        out = tmp_path / "out.mp4"
        durations = [1.0, 0.1, 0.1]
        compile_frames_to_mp4(paths, 1.0, out, durations)
        assert out.is_file()
        assert out.stat().st_size > 100

        ffprobe = shutil.which("ffprobe")
        if ffprobe:
            result = subprocess.run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(out),
                ],
                capture_output=True,
                text=True,
            )
            assert result.returncode == 0
            video_duration = float(result.stdout.strip())
            expected = sum(durations)
            assert abs(video_duration - expected) < 0.35
