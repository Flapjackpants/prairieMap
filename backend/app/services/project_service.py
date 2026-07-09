from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from app.models.project import (
    BLANK_ASSET_PREFIX,
    AssetFrameState,
    AssetTarget,
    CityMarker,
    CountryTerritory,
    DivisionIconPatch,
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
    suppressed = set(next_state.annotations.suppressedFactionIds or [])
    carried = [
        clone_country(c)
        for c in prev.annotations.countries
        if c.factionId not in existing_factions and c.factionId not in suppressed
    ]
    return next_state.model_copy(
        update={
            "annotations": next_state.annotations.model_copy(
                update={"countries": [*carried, *next_state.annotations.countries]}
            )
        }
    )


def _add_suppressed_factions(
    state: AssetFrameState, faction_ids: set[str]
) -> AssetFrameState:
    if not faction_ids:
        return state
    merged = list(set(state.annotations.suppressedFactionIds or []) | faction_ids)
    return state.model_copy(
        update={
            "annotations": state.annotations.model_copy(
                update={"suppressedFactionIds": merged}
            )
        }
    )


def infer_suppressed_factions(project: ProjectBody) -> ProjectBody:
    """Infer faction suppressions from sparse per-frame territory data (e.g. after JSON import)."""
    if len(project.timeline) < 2:
        return project

    assets = {k: list(v) for k, v in project.assets.items()}
    for index in range(1, len(project.timeline)):
        prev_entry = project.timeline[index - 1]
        curr_entry = project.timeline[index]
        prev = get_asset_state(assets, prev_entry.filename, prev_entry.copyIndex)
        curr = get_asset_state(assets, curr_entry.filename, curr_entry.copyIndex)
        prev_factions = {c.factionId for c in prev.annotations.countries}
        curr_factions = {c.factionId for c in curr.annotations.countries}
        removed = prev_factions - curr_factions
        if not removed or not curr.annotations.countries:
            continue
        updated = _add_suppressed_factions(curr, removed)
        target = AssetTarget(filename=curr_entry.filename, copyIndex=curr_entry.copyIndex)
        assets = update_asset_at(assets, target, lambda _: updated)

    return project.model_copy(update={"assets": assets})


def sanitize_suppressed_countries(project: ProjectBody) -> ProjectBody:
    """Remove countries whose factions were marked suppressed (fixes pre-baked overlap in JSON)."""
    assets = {k: list(v) for k, v in project.assets.items()}
    changed = False
    for filename, copies in assets.items():
        for index, copy in enumerate(copies):
            suppressed = set(copy.annotations.suppressedFactionIds or [])
            if not suppressed:
                continue
            countries = [
                c for c in copy.annotations.countries if c.factionId not in suppressed
            ]
            if len(countries) == len(copy.annotations.countries):
                continue
            copies[index] = copy.model_copy(
                update={
                    "annotations": copy.annotations.model_copy(
                        update={"countries": countries}
                    )
                }
            )
            changed = True
    if not changed:
        return project
    return project.model_copy(update={"assets": assets})


def add_territory_region(
    project: ProjectBody,
    target: AssetTarget,
    faction_id: str,
    faction_name: str,
    color: str,
    region: PolygonRing,
    target_country_id: str | None = None,
) -> ProjectBody:
    def apply_region(state: AssetFrameState) -> AssetFrameState:
        before_factions = {c.factionId for c in state.annotations.countries}
        countries = apply_territory_transfer(
            state.annotations.countries,
            region,
            faction_id,
            faction_name,
            color,
            target_country_id,
        )
        removed = before_factions - {c.factionId for c in countries}
        annotations = state.annotations.model_copy(update={"countries": countries})
        if removed:
            annotations = annotations.model_copy(
                update={
                    "suppressedFactionIds": list(
                        set(annotations.suppressedFactionIds or []) | removed
                    )
                }
            )
        return state.model_copy(update={"annotations": annotations})

    assets = update_asset_at(project.assets, target, apply_region)
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


def _apply_division_icon_patch(
    division: DivisionMarker, patch: DivisionIconPatch
) -> DivisionMarker:
    updates: dict = {}
    if patch.name is not None:
        updates["name"] = patch.name
    if patch.sourceFilename is not None:
        updates["sourceFilename"] = patch.sourceFilename
    if patch.crop is not None:
        updates["crop"] = patch.crop
    if patch.size is not None:
        updates["size"] = patch.size
    if not updates:
        return division
    return division.model_copy(update=updates)


def update_division_icon(
    project: ProjectBody,
    division_id: str,
    patch: DivisionIconPatch,
    scope: str,
    target: AssetTarget | None,
) -> ProjectBody | None:
    icon_patch = DivisionIconPatch.model_validate(patch)
    found = False

    if scope == "current_frame":
        if target is None:
            return None
        frame_state = get_asset_state(project.assets, target.filename, target.copyIndex)
        updated_divisions: list[DivisionMarker] = []
        for division in frame_state.annotations.divisions:
            if division.id == division_id:
                updated_divisions.append(_apply_division_icon_patch(division, icon_patch))
                found = True
            else:
                updated_divisions.append(division)
        if not found:
            return None
        assets = update_asset_at(
            project.assets,
            target,
            lambda s: s.model_copy(
                update={
                    "annotations": s.annotations.model_copy(
                        update={"divisions": updated_divisions}
                    )
                }
            ),
        )
        return project.model_copy(update={"assets": assets})

    assets = {k: list(v) for k, v in project.assets.items()}
    for filename, copies in assets.items():
        for copy_index, frame_state in enumerate(copies):
            updated_divisions = []
            frame_changed = False
            for division in frame_state.annotations.divisions:
                if division.id == division_id:
                    updated_divisions.append(_apply_division_icon_patch(division, icon_patch))
                    frame_changed = True
                    found = True
                else:
                    updated_divisions.append(division)
            if frame_changed:
                copies[copy_index] = frame_state.model_copy(
                    update={
                        "annotations": frame_state.annotations.model_copy(
                            update={"divisions": updated_divisions}
                        )
                    }
                )
    if not found:
        return None
    return project.model_copy(update={"assets": assets})


def _filter_division_from_frame(
    assets: dict[str, list[AssetFrameState]],
    target: AssetTarget,
    division_id: str,
) -> tuple[dict[str, list[AssetFrameState]], bool]:
    frame_state = get_asset_state(assets, target.filename, target.copyIndex)
    filtered = [d for d in frame_state.annotations.divisions if d.id != division_id]
    if len(filtered) == len(frame_state.annotations.divisions):
        return assets, False
    next_assets = update_asset_at(
        assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": s.annotations.model_copy(update={"divisions": filtered})
            }
        ),
    )
    return next_assets, True


def remove_division(
    project: ProjectBody,
    division_id: str,
    scope: str,
    target: AssetTarget | None,
    from_timeline_index: int | None = None,
) -> ProjectBody | None:
    found = False
    assets = {k: list(v) for k, v in project.assets.items()}

    if scope == "current_frame":
        if target is None:
            return None
        assets, changed = _filter_division_from_frame(assets, target, division_id)
        if not changed:
            return None
        return project.model_copy(update={"assets": assets})

    if scope == "current_and_future":
        start_idx = (
            from_timeline_index
            if from_timeline_index is not None
            else project.currentTimelineIndex
        )
        start_idx = clamp_timeline_index(start_idx, len(project.timeline))
        for entry in project.timeline[start_idx:]:
            target_entry = AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex)
            assets, changed = _filter_division_from_frame(assets, target_entry, division_id)
            if changed:
                found = True
        if not found:
            return None
        return project.model_copy(update={"assets": assets})

    return None


def paste_territory_from_frame(
    project: ProjectBody,
    target: AssetTarget,
    source_timeline_index: int,
) -> ProjectBody | None:
    if not project.timeline:
        return None
    if source_timeline_index < 0 or source_timeline_index >= len(project.timeline):
        return None

    source_entry = project.timeline[source_timeline_index]
    source_state = get_asset_state(
        project.assets, source_entry.filename, source_entry.copyIndex
    )
    from app.services.clone import clone_country

    cloned_countries = [clone_country(c) for c in source_state.annotations.countries]
    assets = update_asset_at(
        project.assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": s.annotations.model_copy(
                    update={"countries": cloned_countries}
                )
            }
        ),
    )
    return project.model_copy(update={"assets": assets})


def _filter_country_from_frame(
    assets: dict[str, list[AssetFrameState]],
    target: AssetTarget,
    country_id: str,
) -> tuple[dict[str, list[AssetFrameState]], bool]:
    frame_state = get_asset_state(assets, target.filename, target.copyIndex)
    filtered = [c for c in frame_state.annotations.countries if c.id != country_id]
    if len(filtered) == len(frame_state.annotations.countries):
        return assets, False
    next_assets = update_asset_at(
        assets,
        target,
        lambda s: s.model_copy(
            update={
                "annotations": s.annotations.model_copy(update={"countries": filtered})
            }
        ),
    )
    return next_assets, True


def _filter_faction_from_frame(
    assets: dict[str, list[AssetFrameState]],
    target: AssetTarget,
    faction_id: str,
) -> tuple[dict[str, list[AssetFrameState]], bool]:
    frame_state = get_asset_state(assets, target.filename, target.copyIndex)
    filtered = [c for c in frame_state.annotations.countries if c.factionId != faction_id]
    if len(filtered) == len(frame_state.annotations.countries):
        return assets, False
    next_assets = update_asset_at(
        assets,
        target,
        lambda s: _add_suppressed_factions(
            s.model_copy(
                update={
                    "annotations": s.annotations.model_copy(update={"countries": filtered})
                }
            ),
            {faction_id},
        ),
    )
    return next_assets, True


def delete_country(
    project: ProjectBody,
    target: AssetTarget,
    country_id: str,
    scope: str = "current_frame",
    from_timeline_index: int | None = None,
) -> ProjectBody | None:
    if scope == "current_frame":
        frame_state = get_asset_state(project.assets, target.filename, target.copyIndex)
        country = next(
            (c for c in frame_state.annotations.countries if c.id == country_id),
            None,
        )
        if country is None:
            return None
        assets, changed = _filter_country_from_frame(
            {k: list(v) for k, v in project.assets.items()},
            target,
            country_id,
        )
        if not changed:
            return None
        assets = update_asset_at(
            assets,
            target,
            lambda s: _add_suppressed_factions(s, {country.factionId}),
        )
        return project.model_copy(update={"assets": assets})

    if scope == "current_and_future":
        frame_state = get_asset_state(project.assets, target.filename, target.copyIndex)
        country = next(
            (c for c in frame_state.annotations.countries if c.id == country_id),
            None,
        )
        if country is None:
            return None

        faction_id = country.factionId
        found = False
        assets = {k: list(v) for k, v in project.assets.items()}
        start_idx = (
            from_timeline_index
            if from_timeline_index is not None
            else project.currentTimelineIndex
        )
        start_idx = clamp_timeline_index(start_idx, len(project.timeline))
        for entry in project.timeline[start_idx:]:
            target_entry = AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex)
            assets, changed = _filter_faction_from_frame(assets, target_entry, faction_id)
            if changed:
                found = True
        if not found:
            return None
        return project.model_copy(update={"assets": assets})

    return None


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


def append_recorded_frame(
    project: ProjectBody,
    source_index: int,
    divisions: list[DivisionMarker],
    known_filenames: list[str],
) -> ProjectBody | None:
    options = FrameDuplicateOptions(
        duplicateMapImage=True,
        duplicateAnnotations=True,
        duplicateInfoBoard=True,
    )
    duplicated = duplicate_frame(project, source_index, options, known_filenames)
    if duplicated is None:
        return None

    new_index = duplicated.currentTimelineIndex
    if new_index < 0 or new_index >= len(duplicated.timeline):
        return None

    entry = duplicated.timeline[new_index]
    assets = {k: list(v) for k, v in duplicated.assets.items()}
    frame_state = get_asset_state(assets, entry.filename, entry.copyIndex)
    updated_annotations = frame_state.annotations.model_copy(update={"divisions": divisions})
    assets[entry.filename][entry.copyIndex] = frame_state.model_copy(
        update={"annotations": updated_annotations}
    )

    return duplicated.model_copy(update={"assets": assets})


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
    project: ProjectBody,
    faction_id: str,
    name: str | None,
    hex_color: str | None,
    flag_filename: str | None = None,
    *,
    set_flag: bool = False,
) -> ProjectBody:
    palette_entry = next((p for p in project.palette if p.id == faction_id), None)
    if not palette_entry:
        return project
    next_name = name if name is not None else palette_entry.name
    next_hex = hex_color if hex_color is not None else palette_entry.hex
    palette_updates: dict[str, object] = {"name": next_name, "hex": next_hex}
    if set_flag:
        palette_updates["flagFilename"] = flag_filename
    palette = [
        p.model_copy(update=palette_updates) if p.id == faction_id else p for p in project.palette
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


def format_timeline_date_title(dt: datetime) -> str:
    month = dt.month
    day = dt.day
    year = dt.year % 100
    hour24 = dt.hour
    minute = dt.minute
    ampm = "pm" if hour24 >= 12 else "am"
    hour12 = hour24 % 12 or 12
    return f"{month}/{day}/{year}, {hour12}:{minute:02d}{ampm}"


def auto_fill_timeline_dates(
    project: ProjectBody,
    start_at: datetime,
    frames_per_step: int,
    minutes_per_step: int,
    sync_event_log: bool = False,
) -> ProjectBody:
    if frames_per_step < 1:
        raise ValueError("framesPerStep must be at least 1")
    if minutes_per_step < 0:
        raise ValueError("minutesPerStep must be non-negative")

    assets = {k: list(v) for k, v in project.assets.items()}
    # When syncing the event log, every frame that shares a date (i.e. falls in
    # the same step) should carry the event log of the first frame in that step.
    step_event_logs: dict[int, str] = {}
    for index, entry in enumerate(project.timeline):
        step = index // frames_per_step
        dt = start_at + timedelta(minutes=step * minutes_per_step)
        date_title = format_timeline_date_title(dt)
        target = AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex)
        frame_state = get_asset_state(assets, target.filename, target.copyIndex)
        info_update: dict = {"dateTitle": date_title}
        if sync_event_log:
            if step not in step_event_logs:
                step_event_logs[step] = frame_state.info.description
            info_update["description"] = step_event_logs[step]
        updated = frame_state.model_copy(
            update={"info": frame_state.info.model_copy(update=info_update)}
        )
        copies = list(assets.get(target.filename, []))
        while len(copies) <= target.copyIndex:
            copies.append(create_empty_asset_state())
        copies[target.copyIndex] = updated
        assets[target.filename] = copies
    return project.model_copy(update={"assets": assets})


def sync_event_logs_by_date(project: ProjectBody) -> ProjectBody:
    """Make every frame that shares a (non-empty) Date_Era carry the same event
    log. The first frame of each date group (in timeline order) is the source."""
    assets = {k: list(v) for k, v in project.assets.items()}
    source_by_date: dict[str, str] = {}
    for entry in project.timeline:
        frame_state = get_asset_state(assets, entry.filename, entry.copyIndex)
        date_title = frame_state.info.dateTitle.strip()
        if not date_title:
            continue
        if date_title not in source_by_date:
            source_by_date[date_title] = frame_state.info.description
            continue
        description = source_by_date[date_title]
        if frame_state.info.description == description:
            continue
        updated = frame_state.model_copy(
            update={"info": frame_state.info.model_copy(update={"description": description})}
        )
        copies = list(assets.get(entry.filename, []))
        while len(copies) <= entry.copyIndex:
            copies.append(create_empty_asset_state())
        copies[entry.copyIndex] = updated
        assets[entry.filename] = copies
    return project.model_copy(update={"assets": assets})


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
    project = project.model_copy(update={"assets": assets})

    # Keep event logs in sync across frames that share a Date_Era so edits made
    # on one frame propagate everywhere and export the same way.
    if (
        project.displaySettings.syncEventLogsByDate
        and patch.get("description") is not None
    ):
        project = _propagate_description_for_target(project, target)
    return project


def _propagate_description_for_target(
    project: ProjectBody, target: AssetTarget
) -> ProjectBody:
    edited = get_asset_state(project.assets, target.filename, target.copyIndex)
    date_title = edited.info.dateTitle.strip()
    if not date_title:
        return project
    description = edited.info.description

    assets = {k: list(v) for k, v in project.assets.items()}
    for entry in project.timeline:
        if entry.filename == target.filename and entry.copyIndex == target.copyIndex:
            continue
        frame_state = get_asset_state(assets, entry.filename, entry.copyIndex)
        if frame_state.info.dateTitle.strip() != date_title:
            continue
        if frame_state.info.description == description:
            continue
        updated = frame_state.model_copy(
            update={"info": frame_state.info.model_copy(update={"description": description})}
        )
        copies = list(assets.get(entry.filename, []))
        while len(copies) <= entry.copyIndex:
            copies.append(create_empty_asset_state())
        copies[entry.copyIndex] = updated
        assets[entry.filename] = copies
    return project.model_copy(update={"assets": assets})
