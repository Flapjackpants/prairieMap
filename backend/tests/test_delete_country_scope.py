from app.models.project import AssetTarget
from app.services import project_service
from app.services.geometry import apply_territory_transfer


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png", "map3.png"])


def _square_region(x: float, y: float, size: float = 100):
    return [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
    ]


def _add_nation(project, timeline_index: int, faction_id: str = "crimson"):
    entry = project.timeline[timeline_index]
    target = AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex)
    return project_service.add_territory_region(
        project,
        target,
        faction_id=faction_id,
        faction_name="nation1",
        color="#ff2d55",
        region=_square_region(10 + timeline_index * 5, 10),
    )


def test_delete_country_current_frame_only():
    project = _sample_project()
    project = _add_nation(project, 0)
    project = _add_nation(project, 1)
    project = _add_nation(project, 2)

    entry1 = project.timeline[1]
    frame1 = project_service.get_asset_state(
        project.assets, entry1.filename, entry1.copyIndex
    )
    country_id = frame1.annotations.countries[0].id

    result = project_service.delete_country(
        project,
        AssetTarget(filename=entry1.filename, copyIndex=entry1.copyIndex),
        country_id,
        "current_frame",
    )
    assert result is not None

    frame0 = project_service.get_asset_state(
        result.assets, project.timeline[0].filename, project.timeline[0].copyIndex
    )
    frame1_after = project_service.get_asset_state(
        result.assets, entry1.filename, entry1.copyIndex
    )
    frame2 = project_service.get_asset_state(
        result.assets, project.timeline[2].filename, project.timeline[2].copyIndex
    )
    assert len(frame0.annotations.countries) == 1
    assert frame1_after.annotations.countries == []
    assert len(frame2.annotations.countries) == 1


def test_delete_country_current_and_future_by_faction():
    project = _sample_project()
    project = _add_nation(project, 0)
    project = _add_nation(project, 1)
    project = _add_nation(project, 2)

    project = project.model_copy(update={"currentTimelineIndex": 1})
    entry1 = project.timeline[1]
    frame1 = project_service.get_asset_state(
        project.assets, entry1.filename, entry1.copyIndex
    )
    country_id = frame1.annotations.countries[0].id
    faction_id = frame1.annotations.countries[0].factionId

    result = project_service.delete_country(
        project,
        AssetTarget(filename=entry1.filename, copyIndex=entry1.copyIndex),
        country_id,
        "current_and_future",
        from_timeline_index=1,
    )
    assert result is not None

    frame0 = project_service.get_asset_state(
        result.assets, project.timeline[0].filename, project.timeline[0].copyIndex
    )
    frame1_after = project_service.get_asset_state(
        result.assets, entry1.filename, entry1.copyIndex
    )
    frame2 = project_service.get_asset_state(
        result.assets, project.timeline[2].filename, project.timeline[2].copyIndex
    )
    assert len(frame0.annotations.countries) == 1
    assert frame0.annotations.countries[0].factionId == faction_id
    assert frame1_after.annotations.countries == []
    assert frame2.annotations.countries == []
