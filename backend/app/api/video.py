from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.services.video import compile_frames_to_mp4

router = APIRouter(prefix="/video", tags=["video"])


@router.post("/compile")
async def compile_video(
    seconds_per_frame: float = Form(2.0),
    frame_durations: str | None = Form(None),
    frames: list[UploadFile] = File(...),
) -> Response:
    if not frames:
        raise HTTPException(status_code=400, detail="At least one frame image required")

    tmp_dir = Path(tempfile.mkdtemp(prefix="prairiemap_video_"))
    try:
        frame_paths: list[Path] = []
        for i, upload in enumerate(frames):
            suffix = Path(upload.filename or "frame.png").suffix or ".png"
            dest = tmp_dir / f"frame_{i:04d}{suffix}"
            content = await upload.read()
            dest.write_bytes(content)
            frame_paths.append(dest)

        output = tmp_dir / "output.mp4"
        durations: list[float] | None = None
        if frame_durations is not None and frame_durations.strip():
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
            if len(parsed) != len(frame_paths):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"frame_durations length ({len(parsed)}) must match "
                        f"frame count ({len(frame_paths)})"
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
