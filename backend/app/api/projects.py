from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.models.project import ImportPayload, ProjectBody, ProjectMeta, ProjectMutationResponse
from app.services import project_store
from app.services.export_schema import import_to_project, state_to_export

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectMeta])
def list_projects() -> list[ProjectMeta]:
    return project_store.list_projects()


@router.post("", response_model=ProjectMutationResponse)
def create_project(body: ProjectBody | None = None) -> ProjectMutationResponse:
    project_id, project = project_store.create_project(body)
    return ProjectMutationResponse(project=project, projectId=project_id)


@router.get("/{project_id}", response_model=ProjectBody)
def get_project(project_id: str) -> ProjectBody:
    project = project_store.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectMutationResponse)
def save_project(project_id: str, body: ProjectBody) -> ProjectMutationResponse:
    project_store.save_project(project_id, body)
    return ProjectMutationResponse(project=body, projectId=project_id)


@router.delete("/{project_id}")
def delete_project(project_id: str) -> dict[str, bool]:
    ok = project_store.delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@router.post("/import", response_model=ProjectMutationResponse)
def import_project(payload: ImportPayload) -> ProjectMutationResponse:
    project = import_to_project(payload.data)
    project_id, _ = project_store.create_project(project)
    saved = project_store.load_project(project_id)
    assert saved is not None
    return ProjectMutationResponse(project=saved, projectId=project_id)


@router.get("/{project_id}/export")
def export_project(project_id: str) -> JSONResponse:
    project = project_store.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    export_data = state_to_export(project)
    return JSONResponse(content=export_data.model_dump())
