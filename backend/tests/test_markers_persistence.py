from app.models.project import (
    AssetFrameState,
    AssetTarget,
    CityMarker,
    CountryLabelSettings,
    CountryTerritory,
    DivisionCropRect,
    DivisionMarker,
    FrameAnnotations,
    FrameInfo,
    ProjectBody,
    TimelineEntry,
)
from app.services.project_service import (
    add_territory_region,
    get_asset_state,
    set_timeline_index,
    upsert_markers,
)


def _frame_with_markers() -> AssetFrameState:
    return AssetFrameState(
        annotations=FrameAnnotations(
            countries=[],
            cities=[CityMarker(id="city1", x=10, y=20, name="Paris")],
            divisions=[
                DivisionMarker(
                    id="div1",
                    name="",
                    x=100,
                    y=200,
                    size=28,
                    sourceFilename="map.png",
                    crop=DivisionCropRect(x=0, y=0, width=32, height=32),
                )
            ],
        ),
        info=FrameInfo(),
    )


def _project_two_frames() -> ProjectBody:
    frame_a = _frame_with_markers()
    frame_b = AssetFrameState(
        annotations=FrameAnnotations(
            countries=[
                CountryTerritory(
                    id="c1",
                    factionId="f2",
                    name="B",
                    color="#00f",
                    labelSettings=CountryLabelSettings(),
                    regionLabels=[],
                    regions=[[[0, 0], [10, 0], [10, 10], [0, 10]]],
                )
            ],
            cities=[CityMarker(id="city2", x=5, y=5, name="Rome")],
            divisions=[],
        ),
        info=FrameInfo(),
    )
    return ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={"a.png": [frame_a], "b.png": [frame_b]},
    )


def test_timeline_switch_preserves_markers_on_both_frames():
    project = _project_two_frames()
    moved = set_timeline_index(project, 1)
    b = get_asset_state(moved.assets, "b.png", 0)
    assert len(b.annotations.cities) == 1
    assert b.annotations.cities[0].name == "Rome"
    assert len(b.annotations.divisions) == 0

    back = set_timeline_index(moved, 0)
    a = get_asset_state(back.assets, "a.png", 0)
    assert len(a.annotations.cities) == 1
    assert a.annotations.cities[0].name == "Paris"
    assert len(a.annotations.divisions) == 1


def test_add_territory_region_preserves_markers():
    project = _project_two_frames()
    target = AssetTarget(filename="a.png", copyIndex=0)
    region = [[0, 0], [50, 0], [50, 50], [0, 50]]
    updated = add_territory_region(
        project, target, "f1", "Nation", "#f00", region, None
    )
    frame = get_asset_state(updated.assets, "a.png", 0)
    assert len(frame.annotations.cities) == 1
    assert len(frame.annotations.divisions) == 1
    assert len(frame.annotations.countries) >= 1


def test_upsert_markers_then_timeline_switch():
    project = ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={
            "a.png": [AssetFrameState()],
            "b.png": [AssetFrameState()],
        },
    )
    target = AssetTarget(filename="a.png", copyIndex=0)
    cities = [CityMarker(id="c", x=1, y=2, name="X")]
    divisions = [
        DivisionMarker(
            id="d",
            name="",
            x=3,
            y=4,
            size=28,
            sourceFilename="x.png",
            crop=DivisionCropRect(x=0, y=0, width=10, height=10),
        )
    ]
    with_markers = upsert_markers(project, target, cities, divisions)
    after_nav = set_timeline_index(with_markers, 1)
    back = set_timeline_index(after_nav, 0)
    frame = get_asset_state(back.assets, "a.png", 0)
    assert len(frame.annotations.cities) == 1
    assert len(frame.annotations.divisions) == 1
