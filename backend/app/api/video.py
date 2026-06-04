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
        if frame_durations:
            try:
                parsed = json.loads(frame_durations)
                if isinstance(parsed, list) and len(parsed) == len(frame_paths):
                    durations = [float(d) for d in parsed]
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
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
