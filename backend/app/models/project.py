from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

BLANK_ASSET_PREFIX = "__blank__/"
DEFAULT_PALETTE = [
    {"id": "crimson", "name": "nation1", "hex": "#ff2d55"},
    {"id": "blue", "name": "nation2", "hex": "#448aff"},
    {"id": "emerald", "name": "nation3", "hex": "#00e676"},
    {"id": "amber", "name": "nation4", "hex": "#ffc400"},
]


class PaletteColor(BaseModel):
    id: str
    name: str
    hex: str


class CountryLabelSettings(BaseModel):
    fontSize: float = 14
    rotation: float = 0
    letterSpacing: float = 0


class LabelSpine(BaseModel):
    x1: float
    y1: float
    cx: float
    cy: float
    x2: float
    y2: float


class RegionLabelPlacement(BaseModel):
    x: float
    y: float
    fontSize: float
    letterSpacing: float
    spine: LabelSpine | None = None
    rotation: float | None = None


class DivisionCropRect(BaseModel):
    x: float
    y: float
    width: float
    height: float


class CityMarker(BaseModel):
    id: str
    x: float
    y: float
    name: str


class DivisionMarker(BaseModel):
    id: str
    name: str = ""
    x: float
    y: float
    size: float
    sourceFilename: str
    crop: DivisionCropRect


class CountryTerritory(BaseModel):
    id: str
    factionId: str
    name: str
    color: str
    labelSettings: CountryLabelSettings = Field(default_factory=CountryLabelSettings)
    regionLabels: list[RegionLabelPlacement] = Field(default_factory=list)
    regions: list[list[list[float]]] = Field(default_factory=list)


class FrameAnnotations(BaseModel):
    countries: list[CountryTerritory] = Field(default_factory=list)
    cities: list[CityMarker] = Field(default_factory=list)
    divisions: list[DivisionMarker] = Field(default_factory=list)


class FactionStat(BaseModel):
    id: str
    factionId: str
    metric: str
    value: str


class FrameInfo(BaseModel):
    dateTitle: str = ""
    description: str = ""
    factionStats: list[FactionStat] = Field(default_factory=list)


class AssetFrameState(BaseModel):
    annotations: FrameAnnotations = Field(default_factory=FrameAnnotations)
    info: FrameInfo = Field(default_factory=FrameInfo)


class TimelineEntry(BaseModel):
    id: str
    filename: str
    copyIndex: int = 0


class FrameDuplicateOptions(BaseModel):
    duplicateMapImage: bool = True
    duplicateAnnotations: bool = True
    duplicateInfoBoard: bool = True


class ProjectBody(BaseModel):
    """Server-persisted project (no file blobs)."""
    projectName: str = "Untitled Campaign"
    assets: dict[str, list[AssetFrameState]] = Field(default_factory=dict)
    timeline: list[TimelineEntry] = Field(default_factory=list)
    palette: list[PaletteColor] = Field(default_factory=lambda: [PaletteColor(**p) for p in DEFAULT_PALETTE])
    carryOverLabels: bool = True
    currentTimelineIndex: int = 0


class ProjectMeta(BaseModel):
    id: str
    projectName: str


class AssetTarget(BaseModel):
    filename: str
    copyIndex: int


class AddRegionRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    factionId: str
    factionName: str
    color: str
    region: list[list[float]]
    targetCountryId: str | None = None


class DeleteCountryRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    countryId: str


class DuplicateFrameRequest(BaseModel):
    project: ProjectBody
    sourceIndex: int
    options: FrameDuplicateOptions
    knownFilenames: list[str] = Field(default_factory=list)


class ReconcileRequest(BaseModel):
    project: ProjectBody
    filenames: list[str]


class SetTimelineIndexRequest(BaseModel):
    project: ProjectBody
    index: int


class ReorderTimelineRequest(BaseModel):
    project: ProjectBody
    fromIndex: int
    toIndex: int


class DeleteTimelineEntryRequest(BaseModel):
    project: ProjectBody
    index: int


class UpdateFactionMetadataRequest(BaseModel):
    project: ProjectBody
    factionId: str
    name: str | None = None
    hex: str | None = None


class UpdateFrameInfoRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    dateTitle: str | None = None
    description: str | None = None
    factionStats: list[FactionStat] | None = None


class ClaimAnchorRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    countryId: str
    x: float
    y: float
    epsilon: float = 2.0


class RemoveVertexRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    countryId: str
    ringIndex: int
    vertexIndex: int


class MoveVertexRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    countryId: str
    ringIndex: int
    vertexIndex: int
    x: float
    y: float


class UpsertMarkersRequest(BaseModel):
    project: ProjectBody
    target: AssetTarget
    cities: list[CityMarker]
    divisions: list[DivisionMarker]


class ProjectMutationResponse(BaseModel):
    project: ProjectBody
    projectId: str | None = None


class InitFilenamesRequest(BaseModel):
    filenames: list[str]


class ProjectExportV2(BaseModel):
    version: Literal[2] = 2
    projectName: str
    exportedAt: str
    palette: list[PaletteColor]
    carryOverLabels: bool
    assets: dict[str, list[dict[str, Any]]]
    timeline: list[TimelineEntry]


class ImportPayload(BaseModel):
    data: dict[str, Any]
