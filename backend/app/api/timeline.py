from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.project import (
    AppendRecordedFrameRequest,
    AutoFillTimelineDatesRequest,
    DeleteTimelineEntryRequest,
    DuplicateFrameRequest,
    InitFilenamesRequest,
    ProjectMutationResponse,
    ReconcileRequest,
    ReorderTimelineRequest,
    SetTimelineIndexRequest,
    SyncEventLogsRequest,
)
from app.services import project_service

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.post("/set-index", response_model=ProjectMutationResponse)
def set_timeline_index(req: SetTimelineIndexRequest) -> ProjectMutationResponse:
    project = project_service.set_timeline_index(req.project, req.index)
    return ProjectMutationResponse(project=project)


@router.post("/reorder", response_model=ProjectMutationResponse)
def reorder_timeline(req: ReorderTimelineRequest) -> ProjectMutationResponse:
    project = project_service.reorder_timeline(req.project, req.fromIndex, req.toIndex)
    return ProjectMutationResponse(project=project)


@router.post("/delete-entry", response_model=ProjectMutationResponse)
def delete_timeline_entry(req: DeleteTimelineEntryRequest) -> ProjectMutationResponse:
    project = project_service.delete_timeline_entry(req.project, req.index)
    return ProjectMutationResponse(project=project)


@router.post("/duplicate", response_model=ProjectMutationResponse)
def duplicate_frame(req: DuplicateFrameRequest) -> ProjectMutationResponse:
    result = project_service.duplicate_frame(
        req.project, req.sourceIndex, req.options, req.knownFilenames
    )
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot duplicate: no next map available when duplicateMapImage is false",
        )
    return ProjectMutationResponse(project=result)


@router.post("/append-recorded-frame", response_model=ProjectMutationResponse)
def append_recorded_frame(req: AppendRecordedFrameRequest) -> ProjectMutationResponse:
    result = project_service.append_recorded_frame(
        req.project, req.sourceIndex, req.divisions, req.knownFilenames
    )
    if result is None:
        raise HTTPException(status_code=400, detail="Cannot append recorded frame")
    return ProjectMutationResponse(project=result)


@router.post("/reconcile", response_model=ProjectMutationResponse)
def reconcile(req: ReconcileRequest) -> ProjectMutationResponse:
    project = project_service.reconcile_filenames(req.project, req.filenames)
    return ProjectMutationResponse(project=project)


@router.post("/init-from-filenames", response_model=ProjectMutationResponse)
def init_from_filenames(req: InitFilenamesRequest) -> ProjectMutationResponse:
    project = project_service.init_from_filenames(req.filenames)
    return ProjectMutationResponse(project=project)


@router.post("/auto-fill-dates", response_model=ProjectMutationResponse)
def auto_fill_timeline_dates(req: AutoFillTimelineDatesRequest) -> ProjectMutationResponse:
    try:
        start_at = datetime.fromisoformat(req.startAt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid startAt: {e!s}") from e
    try:
        project = project_service.auto_fill_timeline_dates(
            req.project,
            start_at,
            req.framesPerStep,
            req.minutesPerStep,
            req.syncEventLog,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ProjectMutationResponse(project=project)


@router.post("/sync-event-logs", response_model=ProjectMutationResponse)
def sync_event_logs(req: SyncEventLogsRequest) -> ProjectMutationResponse:
    project = project_service.sync_event_logs_by_date(req.project)
    return ProjectMutationResponse(project=project)
