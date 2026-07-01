from app.models.project import AssetTarget
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png"])


def _square_region(x: float, y: float, size: float = 100):
    return [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size],
    ]


def test_paste_territory_from_previous_frame():
    project = _sample_project()
    entry0 = project.timeline[0]
    target0 = AssetTarget(filename=entry0.filename, copyIndex=entry0.copyIndex)

    project = project_service.add_territory_region(
        project,
        target0,
        faction_id="crimson",
        faction_name="nation1",
        color="#ff2d55",
        region=_square_region(10, 10),
    )

    project = project_service.set_timeline_index(project, 1)
    assert project.currentTimelineIndex == 1
    entry1 = project.timeline[1]
    target1 = AssetTarget(filename=entry1.filename, copyIndex=entry1.copyIndex)

    frame1_before = project_service.get_asset_state(
        project.assets, entry1.filename, entry1.copyIndex
    )
    assert frame1_before.annotations.countries == []

    result = project_service.paste_territory_from_frame(project, target1, 0)
    assert result is not None

    frame1_after = project_service.get_asset_state(
        result.assets, entry1.filename, entry1.copyIndex
    )
    frame0 = project_service.get_asset_state(
        result.assets, entry0.filename, entry0.copyIndex
    )
    assert len(frame1_after.annotations.countries) == 1
    assert len(frame0.annotations.countries) == 1
    assert frame1_after.annotations.countries[0].factionId == "crimson"
    assert frame1_after.annotations.countries[0].id != frame0.annotations.countries[0].id
    assert len(frame1_after.annotations.countries[0].regions) == 1
    assert frame1_after.annotations.countries[0].regions[0][0] == [10.0, 10.0]
