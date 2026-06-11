from app.models.project import (
    AssetFrameState,
    AssetTarget,
    FrameDuplicateOptions,
    ProjectBody,
    TimelineEntry,
)
from app.services.project_service import (
    add_territory_region,
    duplicate_frame,
    get_asset_state,
    set_timeline_index,
)


def test_backward_navigation_does_not_copy_territories_to_earlier_frame():
    project = ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={"a.png": [AssetFrameState()], "b.png": [AssetFrameState()]},
    )
    on_frame_two = set_timeline_index(project, 1)
    region = [[0, 0], [50, 0], [50, 50], [0, 50]]
    with_nation = add_territory_region(
        on_frame_two,
        AssetTarget(filename="b.png", copyIndex=0),
        "faction-new",
        "New Nation",
        "#ff2d55",
        region,
        None,
    )
    assert len(get_asset_state(with_nation.assets, "b.png", 0).annotations.countries) >= 1

    with_nation = with_nation.model_copy(update={"currentTimelineIndex": 1})
    back = set_timeline_index(with_nation, 0)
    frame_one = get_asset_state(back.assets, "a.png", 0)
    assert len(frame_one.annotations.countries) == 0


def test_forward_navigation_still_carries_missing_factions():
    project = ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={"a.png": [AssetFrameState()], "b.png": [AssetFrameState()]},
    )
    region = [[0, 0], [50, 0], [50, 50], [0, 50]]
    on_frame_one = add_territory_region(
        project,
        AssetTarget(filename="a.png", copyIndex=0),
        "faction-a",
        "Alpha",
        "#448aff",
        region,
        None,
    )
    on_frame_two = set_timeline_index(on_frame_one, 1)
    frame_two = get_asset_state(on_frame_two.assets, "b.png", 0)
    assert any(c.factionId == "faction-a" for c in frame_two.annotations.countries)


def test_revisit_empty_frame_after_editing_prior_does_not_carry():
    project = ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={"a.png": [AssetFrameState()], "b.png": [AssetFrameState()]},
    )
    region = [[0, 0], [50, 0], [50, 50], [0, 50]]
    on_frame_one = add_territory_region(
        project,
        AssetTarget(filename="a.png", copyIndex=0),
        "faction-a",
        "Alpha",
        "#448aff",
        region,
        None,
    )
    duplicated = duplicate_frame(
        on_frame_one,
        0,
        FrameDuplicateOptions(
            duplicateMapImage=False,
            duplicateAnnotations=False,
            duplicateInfoBoard=False,
        ),
        known_filenames=["a.png", "b.png"],
    )
    assert duplicated is not None
    assert duplicated.currentTimelineIndex == 1
    frame_two = get_asset_state(duplicated.assets, "b.png", 0)
    assert len(frame_two.annotations.countries) == 0

    on_frame_one_again = set_timeline_index(duplicated, 0)
    back_to_two = set_timeline_index(on_frame_one_again, 1)
    frame_two_again = get_asset_state(back_to_two.assets, "b.png", 0)
    assert len(frame_two_again.annotations.countries) == 0
