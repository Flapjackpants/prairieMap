from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.services.frame_pack import unpack_frame_pack
from app.services.video import compile_frames_to_mp4

router = APIRouter(prefix="/video", tags=["video"])


def _parse_frame_durations(
    frame_durations: str | None, frame_count: int
) -> list[float] | None:
    if frame_durations is None or not frame_durations.strip():
        return None
    try:
        parsed = json.loads(frame_durations)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid frame_durations JSON: {e!s}",
        ) from e
    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=400,
            detail="frame_durations must be a JSON array",
        )
    if len(parsed) != frame_count:
        raise HTTPException(
            status_code=400,
            detail=(
                f"frame_durations length ({len(parsed)}) must match "
                f"frame count ({frame_count})"
            ),
        )
    try:
        durations = [float(d) for d in parsed]
    except (TypeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"frame_durations must be numbers: {e!s}",
        ) from e
    if not all(d > 0 for d in durations):
        raise HTTPException(
            status_code=400,
            detail="Each frame_durations entry must be positive",
        )
    return durations


@router.post("/compile")
async def compile_video(
    seconds_per_frame: float = Form(2.0),
    frame_durations: str | None = Form(None),
    frame_pack: UploadFile = File(...),
) -> Response:
    tmp_dir = Path(tempfile.mkdtemp(prefix="prairiemap_video_"))
    try:
        frame_paths = await unpack_frame_pack(frame_pack, tmp_dir)
        durations = _parse_frame_durations(frame_durations, len(frame_paths))
        output = tmp_dir / "output.mp4"
        compile_frames_to_mp4(frame_paths, seconds_per_frame, output, durations)
        data = output.read_bytes()
        return Response(
            content=data,
            media_type="video/mp4",
            headers={
                "Content-Disposition": 'attachment; filename="prairiemap-timeline.mp4"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Video compile error: {e!s}",
        ) from e
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
