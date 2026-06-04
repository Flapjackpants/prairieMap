from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from fastapi import HTTPException


def _find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for candidate in (
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ):
        if Path(candidate).is_file():
            return candidate
    return None


def _probe_size(image_path: Path) -> tuple[int, int]:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        for candidate in (
            "/opt/homebrew/bin/ffprobe",
            "/usr/local/bin/ffprobe",
            "/usr/bin/ffprobe",
        ):
            if Path(candidate).is_file():
                ffprobe = candidate
                break
    if not ffprobe:
        return 1920, 1080
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=0:x:p=0",
        str(image_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and result.stdout.strip():
        parts = result.stdout.strip().split(",")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    return 1920, 1080


def _even(n: int) -> int:
    return max(2, n - (n % 2))


def compile_frames_to_mp4(
    frame_paths: list[Path],
    seconds_per_frame: float,
    output_path: Path,
) -> None:
    if not frame_paths:
        raise HTTPException(status_code=400, detail="No frames provided")
    if seconds_per_frame <= 0:
        raise HTTPException(status_code=400, detail="seconds_per_frame must be positive")

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        raise HTTPException(
            status_code=503,
            detail="ffmpeg not found. Install ffmpeg (e.g. brew install ffmpeg) and restart the API.",
        )

    work_dir = frame_paths[0].parent
    ordered = sorted(frame_paths, key=lambda p: p.name)
    for i, src in enumerate(ordered):
        dest = work_dir / f"frame_{i:04d}.png"
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)

    max_w, max_h = 0, 0
    for p in ordered:
        w, h = _probe_size(p)
        max_w = max(max_w, w)
        max_h = max(max_h, h)
    target_w = _even(max_w)
    target_h = _even(max_h)

    framerate = 1.0 / seconds_per_frame
    vf = (
        f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
        f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:color=0x121315,"
        "setsar=1,"
        f"fps={framerate}"
    )

    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        str(framerate),
        "-start_number",
        "0",
        "-i",
        str(work_dir / "frame_%04d.png"),
        "-frames:v",
        str(len(ordered)),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "unknown ffmpeg error").strip()
        raise HTTPException(
            status_code=500,
            detail=f"ffmpeg failed: {err[-3000:]}",
        )

    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise HTTPException(status_code=500, detail="ffmpeg produced an empty video file")
