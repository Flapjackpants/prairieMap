from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.models.project import ProjectBody, ProjectMeta

PROJECTS_DIR = Path(__file__).resolve().parent.parent.parent / "projects"


def _ensure_dir() -> None:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def _path(project_id: str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"


def list_projects() -> list[ProjectMeta]:
    _ensure_dir()
    metas: list[ProjectMeta] = []
    for file in PROJECTS_DIR.glob("*.json"):
        try:
            data = json.loads(file.read_text())
            metas.append(ProjectMeta(id=file.stem, projectName=data.get("projectName", file.stem)))
        except Exception:
            continue
    return sorted(metas, key=lambda m: m.projectName.lower())


def create_project(body: ProjectBody | None = None) -> tuple[str, ProjectBody]:
    _ensure_dir()
    project_id = str(uuid.uuid4())
    project = body or ProjectBody()
    save_project(project_id, project)
    return project_id, project


def load_project(project_id: str) -> ProjectBody | None:
    path = _path(project_id)
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return ProjectBody.model_validate(data)


def save_project(project_id: str, body: ProjectBody) -> None:
    _ensure_dir()
    _path(project_id).write_text(body.model_dump_json(indent=2))


def delete_project(project_id: str) -> bool:
    path = _path(project_id)
    if path.exists():
        path.unlink()
        return True
    return False
