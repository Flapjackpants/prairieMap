from __future__ import annotations

import uuid

from app.models.project import (
    AssetFrameState,
    CountryTerritory,
    FactionStat,
    FrameAnnotations,
    FrameInfo,
)
PolygonRing = list[list[float]]


def clone_ring(ring: PolygonRing) -> PolygonRing:
    return [[p[0], p[1]] for p in ring]


def clone_country(country: CountryTerritory) -> CountryTerritory:
    cloned = CountryTerritory(
        id=str(uuid.uuid4()),
        factionId=country.factionId,
        name=country.name,
        color=country.color,
        extensionColor=country.extensionColor,
        labelSettings=country.labelSettings.model_copy(),
        regionLabels=[l.model_copy() for l in country.regionLabels],
        regions=[clone_ring(r) for r in country.regions],
        extensionRegions=[clone_ring(r) for r in country.extensionRegions],
    )
    return cloned


def clone_faction_stat(stat: FactionStat) -> FactionStat:
    return FactionStat(
        id=str(uuid.uuid4()),
        factionId=stat.factionId,
        metric=stat.metric,
        value=stat.value,
    )


def clone_annotations(source: FrameAnnotations) -> FrameAnnotations:
    return FrameAnnotations(countries=[clone_country(c) for c in source.countries])


def clone_frame_info(source: FrameInfo) -> FrameInfo:
    return FrameInfo(
        dateTitle=source.dateTitle,
        description=source.description,
        factionStats=[clone_faction_stat(s) for s in source.factionStats],
    )


def clone_asset_state(source: AssetFrameState) -> AssetFrameState:
    return AssetFrameState(
        annotations=clone_annotations(source.annotations),
        info=clone_frame_info(source.info),
    )
