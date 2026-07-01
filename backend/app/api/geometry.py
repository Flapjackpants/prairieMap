from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.project import (
    AddPaletteColorRequest,
    AddRegionRequest,
    ClaimAnchorRequest,
    DeleteCountryRequest,
    MoveVertexRequest,
    ProjectMutationResponse,
    RemoveVertexRequest,
    UpdateDivisionIconRequest,
    UpdateFactionMetadataRequest,
    UpdateFrameInfoRequest,
    UpsertMarkersRequest,
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
        req.targetCountryId,
    )
    return ProjectMutationResponse(project=project)


@router.post("/delete-country", response_model=ProjectMutationResponse)
def delete_country(req: DeleteCountryRequest) -> ProjectMutationResponse:
    project = project_service.delete_country(req.project, req.target, req.countryId)
    return ProjectMutationResponse(project=project)


@router.post("/update-faction-metadata", response_model=ProjectMutationResponse)
def update_faction_metadata(req: UpdateFactionMetadataRequest) -> ProjectMutationResponse:
    project = project_service.update_faction_metadata(
        req.project,
        req.factionId,
        req.name,
        req.hex,
        req.flagFilename,
        set_flag=req.setFlag,
    )
    return ProjectMutationResponse(project=project)


@router.post("/add-palette-color", response_model=ProjectMutationResponse)
def add_palette_color(req: AddPaletteColorRequest) -> ProjectMutationResponse:
    project = project_service.add_palette_color(req.project, req.name, req.hex)
    return ProjectMutationResponse(project=project)


@router.post("/claim-anchor", response_model=ProjectMutationResponse)
def claim_anchor(req: ClaimAnchorRequest) -> ProjectMutationResponse:
    project = project_service.claim_anchor(
        req.project,
        req.target,
        req.countryId,
        req.x,
        req.y,
        req.epsilon,
    )
    return ProjectMutationResponse(project=project)


@router.post("/remove-vertex", response_model=ProjectMutationResponse)
def remove_vertex(req: RemoveVertexRequest) -> ProjectMutationResponse:
    project = project_service.remove_territory_vertex(
        req.project,
        req.target,
        req.countryId,
        req.ringIndex,
        req.vertexIndex,
    )
    return ProjectMutationResponse(project=project)


@router.post("/move-vertex", response_model=ProjectMutationResponse)
def move_vertex(req: MoveVertexRequest) -> ProjectMutationResponse:
    project = project_service.move_territory_vertex(
        req.project,
        req.target,
        req.countryId,
        req.ringIndex,
        req.vertexIndex,
        req.x,
        req.y,
    )
    return ProjectMutationResponse(project=project)


@router.post("/upsert-markers", response_model=ProjectMutationResponse)
def upsert_markers(req: UpsertMarkersRequest) -> ProjectMutationResponse:
    project = project_service.upsert_markers(
        req.project, req.target, req.cities, req.divisions
    )
    return ProjectMutationResponse(project=project)


@router.post("/update-division-icon", response_model=ProjectMutationResponse)
def update_division_icon(req: UpdateDivisionIconRequest) -> ProjectMutationResponse:
    result = project_service.update_division_icon(
        req.project,
        req.divisionId,
        req.patch,
        req.scope,
        req.target,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Division not found")
    return ProjectMutationResponse(project=result)


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
