from __future__ import annotations

from fastapi import APIRouter

from app.models.project import (
    AddRegionRequest,
    DeleteCountryRequest,
    ProjectMutationResponse,
    UpdateFactionMetadataRequest,
    UpdateFrameInfoRequest,
)
from app.services import project_service

router = APIRouter(prefix="/geometry", tags=["geometry"])


@router.post("/add-region", response_model=ProjectMutationResponse)
def add_region(req: AddRegionRequest) -> ProjectMutationResponse:
    project = project_service.add_territory_region(
        req.project,
        req.target,
        req.factionId,
        req.factionName,
        req.color,
        req.region,
    )
    return ProjectMutationResponse(project=project)


@router.post("/delete-country", response_model=ProjectMutationResponse)
def delete_country(req: DeleteCountryRequest) -> ProjectMutationResponse:
    project = project_service.delete_country(req.project, req.target, req.countryId)
    return ProjectMutationResponse(project=project)


@router.post("/update-faction-metadata", response_model=ProjectMutationResponse)
def update_faction_metadata(req: UpdateFactionMetadataRequest) -> ProjectMutationResponse:
    project = project_service.update_faction_metadata(
        req.project, req.factionId, req.name, req.hex
    )
    return ProjectMutationResponse(project=project)


@router.post("/update-frame-info", response_model=ProjectMutationResponse)
def update_frame_info(req: UpdateFrameInfoRequest) -> ProjectMutationResponse:
    patch = {}
    if req.dateTitle is not None:
        patch["dateTitle"] = req.dateTitle
    if req.description is not None:
        patch["description"] = req.description
    if req.factionStats is not None:
        patch["factionStats"] = req.factionStats
    project = project_service.update_frame_info(req.project, req.target, patch)
    return ProjectMutationResponse(project=project)
