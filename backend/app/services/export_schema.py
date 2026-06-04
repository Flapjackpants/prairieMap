from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.models.project import (
    AssetFrameState,
    CountryTerritory,
    FrameAnnotations,
    FrameInfo,
    PaletteColor,
    ProjectBody,
    ProjectExportV2,
    TimelineEntry,
)
from app.services.geometry import recompute_country_labels


def create_empty_frame_info() -> FrameInfo:
    return FrameInfo()


def create_empty_annotations() -> FrameAnnotations:
    return FrameAnnotations(countries=[])


def create_empty_asset_state() -> AssetFrameState:
    return AssetFrameState(annotations=create_empty_annotations(), info=create_empty_frame_info())


def normalize_country(country: CountryTerritory) -> CountryTerritory:
    if not country.regionLabels and country.regions:
        return recompute_country_labels(country.model_copy(update={"regionLabels": []}))
    if not country.regionLabels:
        return country.model_copy(update={"regionLabels": []})
    return country


def asset_state_to_export(state: AssetFrameState) -> dict[str, Any]:
    return {
        "drawings": {"countries": [c.model_dump() for c in state.annotations.countries]},
        "infoBoard": {
            "date": state.info.dateTitle,
            "text": state.info.description,
            "factionStats": [s.model_dump() for s in state.info.factionStats],
        },
    }


def normalize_drawings(drawings: dict[str, Any]) -> FrameAnnotations:
    if drawings and isinstance(drawings.get("countries"), list):
        countries = [CountryTerritory.model_validate(c) for c in drawings["countries"]]
        return FrameAnnotations(countries=[normalize_country(c) for c in countries])
    return create_empty_annotations()


def export_to_asset_state(entry: dict[str, Any]) -> AssetFrameState:
    drawings = entry.get("drawings") or {}
    info_board = entry.get("infoBoard") or {}
    return AssetFrameState(
        annotations=normalize_drawings(drawings if isinstance(drawings, dict) else {}),
        info=FrameInfo(
            dateTitle=info_board.get("date") or "",
            description=info_board.get("text") or "",
            factionStats=info_board.get("factionStats") or [],
        ),
    )


def state_to_export(project: ProjectBody) -> ProjectExportV2:
    assets: dict[str, list[dict[str, Any]]] = {}
    for filename, copies in project.assets.items():
        assets[filename] = [asset_state_to_export(c) for c in copies]
    return ProjectExportV2(
        projectName=project.projectName,
        exportedAt=datetime.now(timezone.utc).isoformat(),
        palette=project.palette,
        carryOverLabels=project.carryOverLabels,
        assets=assets,
        timeline=[t.model_copy() for t in project.timeline],
    )


def migrate_v1_to_assets(data: dict[str, Any]) -> tuple[dict[str, list[AssetFrameState]], list[TimelineEntry]]:
    assets: dict[str, list[AssetFrameState]] = {}
    timeline: list[TimelineEntry] = []
    for frame in data.get("frames") or []:
        countries = frame.get("annotations", {}).get("countries") or []
        state = AssetFrameState(
            annotations=FrameAnnotations(
                countries=[
                    normalize_country(
                        CountryTerritory.model_validate({**c, "regionLabels": c.get("regionLabels") or []})
                    )
                    for c in countries
                ]
            ),
            info=FrameInfo.model_validate(frame.get("info") or {}),
        )
        filename = frame["filename"]
        if filename not in assets:
            assets[filename] = []
        copy_index = len(assets[filename])
        assets[filename].append(state)
        timeline.append(
            TimelineEntry(id=str(uuid.uuid4()), filename=filename, copyIndex=copy_index)
        )
    return assets, timeline


def import_to_project(data: dict[str, Any]) -> ProjectBody:
    version = data.get("version")
    if version == 2:
        assets: dict[str, list[AssetFrameState]] = {}
        for filename, copies in (data.get("assets") or {}).items():
            assets[filename] = [export_to_asset_state(c) for c in copies]
        return ProjectBody(
            projectName=data.get("projectName") or "Imported Project",
            assets=assets,
            timeline=[TimelineEntry.model_validate(t) for t in data.get("timeline") or []],
            palette=[PaletteColor.model_validate(p) for p in data.get("palette") or []],
            carryOverLabels=data.get("carryOverLabels", True),
            currentTimelineIndex=0,
        )
    assets, timeline = migrate_v1_to_assets(data)
    return ProjectBody(
        projectName="Imported Project",
        assets=assets,
        timeline=timeline,
        palette=[PaletteColor.model_validate(p) for p in data.get("palette") or []],
        carryOverLabels=data.get("carryOverLabels", True),
        currentTimelineIndex=0,
    )


def create_initial_assets_from_files(filenames: list[str]) -> dict[str, list[AssetFrameState]]:
    return {name: [create_empty_asset_state()] for name in filenames}


def create_timeline_from_files(filenames: list[str]) -> list[TimelineEntry]:
    return [TimelineEntry(id=str(uuid.uuid4()), filename=name, copyIndex=0) for name in filenames]
