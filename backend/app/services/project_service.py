from __future__ import annotations

import uuid

from app.models.project import (
    BLANK_ASSET_PREFIX,
    AssetFrameState,
    AssetTarget,
    CityMarker,
    CountryTerritory,
    DivisionMarker,
    FrameAnnotations,
    FrameDuplicateOptions,
    PaletteColor,
    ProjectBody,
    TimelineEntry,
)
from app.services.clone import clone_annotations, clone_asset_state, clone_frame_info
from app.services.export_schema import create_empty_annotations, create_empty_asset_state, create_empty_frame_info
from app.services.geometry import (
    apply_territory_transfer,
    claim_anchor_at_point,
    move_vertex_on_country,
    recompute_country_labels,
    remove_vertex_from_country,
)
from app.services.export_schema import (
    create_initial_assets_from_files,
    create_timeline_from_files,
)

PolygonRing = list[list[float]]


def with_countries(
    annotations: FrameAnnotations, countries: list[CountryTerritory]
) -> FrameAnnotations:
    return annotations.model_copy(update={"countries": countries})


def is_blank_asset_key(filename: str) -> bool:
    return filename.startswith(BLANK_ASSET_PREFIX)


def display_filename(filename: str) -> str:
    if filename.startswith(BLANK_ASSET_PREFIX):
        return filename[len(BLANK_ASSET_PREFIX) :]
    return filename


def get_asset_state(
    assets: dict[str, list[AssetFrameState]], filename: str, copy_index: int
) -> AssetFrameState:
    copies = assets.get(filename)
    if not copies or copy_index >= len(copies):
        return create_empty_asset_state()
    return copies[copy_index]


def ensure_asset_slot(
    assets: dict[str, list[AssetFrameState]], filename: str, copy_index: int
) -> AssetFrameState:
    if filename not in assets:
        assets[filename] = []
    while len(assets[filename]) <= copy_index:
        assets[filename].append(create_empty_asset_state())
    return assets[filename][copy_index]


def update_asset_at(
    assets: dict[str, list[AssetFrameState]],
    target: AssetTarget,
    updater,
) -> dict[str, list[AssetFrameState]]:
    next_assets = {k: list(v) for k, v in assets.items()}
    current = get_asset_state(next_assets, target.filename, target.copyIndex)
    updated = updater(current)
    copies = list(next_assets.get(target.filename, []))
    while len(copies) <= target.copyIndex:
        copies.append(create_empty_asset_state())
    copies[target.copyIndex] = updated
    next_assets[target.filename] = copies
    return next_assets


def clamp_timeline_index(index: int, length: int) -> int:
    if length == 0:
        return 0
    return max(0, min(index, length - 1))


def cleanup_asset_copies(
    assets: dict[str, list[AssetFrameState]], timeline: list[TimelineEntry]
) -> tuple[dict[str, list[AssetFrameState]], list[TimelineEntry]]:
    next_assets = {k: list(v) for k, v in assets.items()}
    next_timeline = [t.model_copy() for t in timeline]
    filenames = set(list(next_assets.keys()) + [t.filename for t in next_timeline])

    for filename in filenames:
        referenced = sorted(
            {t.copyIndex for t in next_timeline if t.filename == filename}
        )
        if not referenced:
            next_assets.pop(filename, None)
            continue
        old_copies = next_assets.get(filename, [])
        new_copies: list[AssetFrameState] = []
        index_map: dict[int, int] = {}
        for old_idx in referenced:
            if old_idx < len(old_copies) and old_copies[old_idx]:
                index_map[old_idx] = len(new_copies)
                new_copies.append(old_copies[old_idx])
            else:
                index_map[old_idx] = len(new_copies)
                new_copies.append(create_empty_asset_state())
        next_assets[filename] = new_copies
        next_timeline = [
            t.model_copy(update={"copyIndex": index_map[t.copyIndex]})
            if t.filename == filename and t.copyIndex in index_map
            else t
            for t in next_timeline
        ]
    return next_assets, next_timeline


def get_next_map_filename(
    timeline: list[TimelineEntry], known_filenames: list[str], source_index: int
) -> str | None:
    for i in range(source_index + 1, len(timeline)):
        filename = timeline[i].filename
        if not is_blank_asset_key(filename):
            return filename
    source_entry = timeline[source_index] if source_index < len(timeline) else None
    if not source_entry:
        return None
    source_name = (
        display_filename(source_entry.filename)
        if is_blank_asset_key(source_entry.filename)
        else source_entry.filename
    )
    files = sorted(known_filenames, key=lambda a: (a.lower(), a))
    try:
        file_idx = files.index(source_name)
        if file_idx < len(files) - 1:
            return files[file_idx + 1]
    except ValueError:
        pass
    return None


def merge_carried_territories(prev: AssetFrameState, next_state: AssetFrameState) -> AssetFrameState:
    from app.services.clone import clone_country

    existing_factions = {c.factionId for c in next_state.annotations.countries}
    carried = [
        clone_country(c)
        for c in prev.annotations.countries
        if c.factionId not in existing_factions
    ]
    return next_state.model_copy(
        update={
            "annotations": next_state.annotations.model_copy(
                update={"countries": [*carried, *next_state.annotations.countries]}
            )
        }
    )


def add_territory_region(
    project: ProjectBody,
    target: AssetTarget,
    faction_id: str,
    faction_name: str,
    color: str,
    region: PolygonRing,
    target_country_id: str | None = None,
) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": with_countries(
                    s.annotations,
                    apply_territory_transfer(
                        s.annotations.countries,
                        region,
                        faction_id,
                        faction_name,
                        color,
                        target_country_id,
                    ),
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def claim_anchor(
    project: ProjectBody,
    target: AssetTarget,
    country_id: str,
    x: float,
    y: float,
    epsilon: float = 2.0,
) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": with_countries(
                    s.annotations,
                    claim_anchor_at_point(
                        s.annotations.countries, country_id, x, y, epsilon
                    ),
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def remove_territory_vertex(
    project: ProjectBody,
    target: AssetTarget,
    country_id: str,
    ring_index: int,
    vertex_index: int,
) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": with_countries(
                    s.annotations,
                    remove_vertex_from_country(
                        s.annotations.countries,
                        country_id,
                        ring_index,
                        vertex_index,
                    ),
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def move_territory_vertex(
    project: ProjectBody,
    target: AssetTarget,
    country_id: str,
    ring_index: int,
    vertex_index: int,
    x: float,
    y: float,
) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": with_countries(
                    s.annotations,
                    move_vertex_on_country(
                        s.annotations.countries,
                        country_id,
                        ring_index,
                        vertex_index,
                        x,
                        y,
                    ),
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def upsert_markers(
    project: ProjectBody,
    target: AssetTarget,
    cities: list[CityMarker],
    divisions: list[DivisionMarker],
) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": s.annotations.model_copy(
                    update={"cities": cities, "divisions": divisions}
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def delete_country(project: ProjectBody, target: AssetTarget, country_id: str) -> ProjectBody:
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": s.annotations.model_copy(
                    update={
                        "countries": [
                            c for c in s.annotations.countries if c.id != country_id
                        ]
                    }
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def _with_visited_timeline(project: ProjectBody, entry_id: str) -> list[str]:
    visited = set(project.visitedTimelineIds)
    visited.add(entry_id)
    return list(visited)


def set_timeline_index(project: ProjectBody, index: int) -> ProjectBody:
    idx = clamp_timeline_index(index, len(project.timeline))
    if idx == project.currentTimelineIndex or not project.timeline:
        return project.model_copy(update={"currentTimelineIndex": idx})

    next_entry = project.timeline[idx]
    visited = set(project.visitedTimelineIds)
    already_visited = next_entry.id in visited
    base_update: dict = {
        "currentTimelineIndex": idx,
        "visitedTimelineIds": _with_visited_timeline(project, next_entry.id),
    }

    if (
        not project.carryOverLabels
        or idx < project.currentTimelineIndex
        or already_visited
    ):
        return project.model_copy(update=base_update)

    prev_entry = project.timeline[project.currentTimelineIndex]
    prev_data = get_asset_state(project.assets, prev_entry.filename, prev_entry.copyIndex)
    next_data = get_asset_state(project.assets, next_entry.filename, next_entry.copyIndex)
    merged = merge_carried_territories(prev_data, next_data)
    assets = update_asset_at(
        project.assets,
        AssetTarget(filename=next_entry.filename, copyIndex=next_entry.copyIndex),
        lambda _: merged,
    )
    return project.model_copy(update={**base_update, "assets": assets})


def reorder_timeline(project: ProjectBody, from_index: int, to_index: int) -> ProjectBody:
    timeline = [t.model_copy() for t in project.timeline]
    if (
        from_index == to_index
        or from_index < 0
        or to_index < 0
        or from_index >= len(timeline)
        or to_index >= len(timeline)
    ):
        return project
    moved = timeline.pop(from_index)
    timeline.insert(to_index, moved)
    current = project.currentTimelineIndex
    if current == from_index:
        current = to_index
    elif from_index < current <= to_index:
        current -= 1
    elif from_index > current >= to_index:
        current += 1
    return project.model_copy(update={"timeline": timeline, "currentTimelineIndex": current})


def delete_timeline_entry(project: ProjectBody, index: int) -> ProjectBody:
    if not project.timeline:
        return project
    delete_index = clamp_timeline_index(index, len(project.timeline))
    removed_id = project.timeline[delete_index].id
    timeline = [t for i, t in enumerate(project.timeline) if i != delete_index]
    current = project.currentTimelineIndex
    if not timeline:
        current = 0
    elif delete_index < current:
        current -= 1
    elif delete_index == current:
        current = min(delete_index, len(timeline) - 1)
    assets, timeline = cleanup_asset_copies(project.assets, timeline)
    visited = [entry_id for entry_id in project.visitedTimelineIds if entry_id != removed_id]
    return project.model_copy(
        update={
            "assets": assets,
            "timeline": timeline,
            "currentTimelineIndex": clamp_timeline_index(current, len(timeline)),
            "visitedTimelineIds": visited,
        }
    )


def duplicate_frame(
    project: ProjectBody,
    source_index: int,
    options: FrameDuplicateOptions,
    known_filenames: list[str],
) -> ProjectBody | None:
    if source_index < 0 or source_index >= len(project.timeline):
        return None
    source_entry = project.timeline[source_index]
    source_data = get_asset_state(project.assets, source_entry.filename, source_entry.copyIndex)
    insert_index = source_index + 1

    if options.duplicateMapImage:
        asset_filename = (
            display_filename(source_entry.filename)
            if is_blank_asset_key(source_entry.filename)
            else source_entry.filename
        )
    else:
        next_map = get_next_map_filename(project.timeline, known_filenames, source_index)
        if not next_map:
            return None
        asset_filename = next_map

    new_state = AssetFrameState(
        annotations=clone_annotations(source_data.annotations)
        if options.duplicateAnnotations
        else create_empty_annotations(),
        info=clone_frame_info(source_data.info)
        if options.duplicateInfoBoard
        else create_empty_frame_info(),
    )

    assets = {k: list(v) for k, v in project.assets.items()}
    if asset_filename not in assets:
        assets[asset_filename] = []
    copy_index = len(assets[asset_filename])
    assets[asset_filename] = [*assets[asset_filename], new_state]

    new_entry = TimelineEntry(
        id=str(uuid.uuid4()), filename=asset_filename, copyIndex=copy_index
    )
    timeline = (
        project.timeline[:insert_index]
        + [new_entry]
        + project.timeline[insert_index:]
    )
    visited = _with_visited_timeline(project, new_entry.id)
    return project.model_copy(
        update={
            "assets": assets,
            "timeline": timeline,
            "currentTimelineIndex": insert_index,
            "visitedTimelineIds": visited,
        }
    )


def reconcile_filenames(project: ProjectBody, filenames: list[str]) -> ProjectBody:
    assets = {k: list(v) for k, v in project.assets.items()}
    timeline = [t.model_copy() for t in project.timeline]
    for name in filenames:
        if name not in assets:
            assets[name] = [create_empty_asset_state()]
            timeline.append(TimelineEntry(id=str(uuid.uuid4()), filename=name, copyIndex=0))
    return project.model_copy(update={"assets": assets, "timeline": timeline})


def init_from_filenames(filenames: list[str]) -> ProjectBody:
    return ProjectBody(
        projectName="Untitled Campaign",
        assets=create_initial_assets_from_files(filenames),
        timeline=create_timeline_from_files(filenames),
        currentTimelineIndex=0,
    )


def add_palette_color(project: ProjectBody, name: str, hex_color: str) -> ProjectBody:
    entry = PaletteColor(id=str(uuid.uuid4()), name=name.strip() or "New Nation", hex=hex_color)
    return project.model_copy(update={"palette": [*project.palette, entry]})


def update_faction_metadata(
    project: ProjectBody, faction_id: str, name: str | None, hex_color: str | None
) -> ProjectBody:
    palette_entry = next((p for p in project.palette if p.id == faction_id), None)
    if not palette_entry:
        return project
    next_name = name if name is not None else palette_entry.name
    next_hex = hex_color if hex_color is not None else palette_entry.hex
    palette = [
        p.model_copy(update={"name": next_name, "hex": next_hex})
        if p.id == faction_id
        else p
        for p in project.palette
    ]
    assets: dict[str, list[AssetFrameState]] = {}
    for filename, copies in project.assets.items():
        new_copies = []
        for copy in copies:
            countries = []
            for c in copy.annotations.countries:
                if c.factionId == faction_id:
                    updated = recompute_country_labels(
                        c.model_copy(update={"name": next_name.upper(), "color": next_hex})
                    )
                    if updated.regions:
                        countries.append(updated)
                else:
                    countries.append(c)
            new_copies.append(
                copy.model_copy(
                    update={"annotations": with_countries(copy.annotations, countries)}
                )
            )
        assets[filename] = new_copies
    return project.model_copy(update={"palette": palette, "assets": assets})


def update_frame_info(
    project: ProjectBody,
    target: AssetTarget,
    patch: dict,
) -> ProjectBody:
    def updater(s: AssetFrameState) -> AssetFrameState:
        info = s.info.model_copy()
        if "dateTitle" in patch and patch["dateTitle"] is not None:
            info = info.model_copy(update={"dateTitle": patch["dateTitle"]})
        if "description" in patch and patch["description"] is not None:
            info = info.model_copy(update={"description": patch["description"]})
        if "factionStats" in patch and patch["factionStats"] is not None:
            info = info.model_copy(update={"factionStats": patch["factionStats"]})
        return s.model_copy(update={"info": info})

    assets = update_asset_at(project.assets, target, updater)
    return project.model_copy(update={"assets": assets})
