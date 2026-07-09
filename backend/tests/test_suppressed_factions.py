from app.models.project import (
    AssetFrameState,
    AssetTarget,
    CountryTerritory,
    CountryLabelSettings,
    FrameAnnotations,
    ProjectBody,
    TimelineEntry,
)
from app.services.export_schema import import_to_project
from app.services.project_service import (
    add_territory_region,
    delete_country,
    get_asset_state,
    infer_suppressed_factions,
    set_timeline_index,
)


def _country(faction_id: str, name: str, color: str) -> CountryTerritory:
    return CountryTerritory(
        id=f"f-{faction_id}",
        factionId=faction_id,
        name=name,
        color=color,
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[[[0, 0], [40, 0], [40, 40], [0, 40]]],
    )


def test_forward_navigation_does_not_restore_suppressed_faction():
    region_a = [[0, 0], [50, 0], [50, 50], [0, 50]]
    region_b = [[60, 0], [110, 0], [110, 50], [60, 50]]
    project = ProjectBody(
        carryOverLabels=True,
        currentTimelineIndex=0,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={"a.png": [AssetFrameState()], "b.png": [AssetFrameState()]},
    )
    with_a = add_territory_region(
        project,
        AssetTarget(filename="a.png", copyIndex=0),
        "faction-a",
        "Alpha",
        "#448aff",
        region_a,
        None,
    )
    on_two = set_timeline_index(with_a, 1)
    with_both = add_territory_region(
        on_two,
        AssetTarget(filename="b.png", copyIndex=0),
        "faction-b",
        "Bravo",
        "#ff2d55",
        region_b,
        None,
    )
    with_both = with_both.model_copy(update={"currentTimelineIndex": 1})
    frame_two_before = get_asset_state(with_both.assets, "b.png", 0)
    faction_a = next(
        c for c in frame_two_before.annotations.countries if c.factionId == "faction-a"
    )
    killed = delete_country(
        with_both,
        AssetTarget(filename="b.png", copyIndex=0),
        faction_a.id,
        scope="current_and_future",
    )
    assert killed is not None

    jumped = set_timeline_index(killed.model_copy(update={"currentTimelineIndex": 0}), 1)
    frame_two = get_asset_state(jumped.assets, "b.png", 0)
    assert all(c.factionId != "faction-a" for c in frame_two.annotations.countries)
    assert "faction-a" in frame_two.annotations.suppressedFactionIds


def test_import_infers_suppressions_from_sparse_json():
    project = ProjectBody(
        carryOverLabels=True,
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={
            "a.png": [
                AssetFrameState(
                    annotations=FrameAnnotations(
                        countries=[_country("faction-a", "Alpha", "#448aff")]
                    )
                )
            ],
            "b.png": [
                AssetFrameState(
                    annotations=FrameAnnotations(
                        countries=[_country("faction-b", "Bravo", "#ff2d55")]
                    )
                )
            ],
        },
    )
    exported = {
        "version": 2,
        "projectName": "Test",
        "palette": [],
        "carryOverLabels": True,
        "assets": {
            "a.png": [
                {
                    "drawings": {
                        "countries": [project.assets["a.png"][0].annotations.countries[0].model_dump()],
                        "cities": [],
                        "divisions": [],
                    },
                    "infoBoard": {"date": "", "text": "", "factionStats": []},
                }
            ],
            "b.png": [
                {
                    "drawings": {
                        "countries": [project.assets["b.png"][0].annotations.countries[0].model_dump()],
                        "cities": [],
                        "divisions": [],
                    },
                    "infoBoard": {"date": "", "text": "", "factionStats": []},
                }
            ],
        },
        "timeline": [
            {"id": "t1", "filename": "a.png", "copyIndex": 0},
            {"id": "t2", "filename": "b.png", "copyIndex": 0},
        ],
    }
    imported = import_to_project(exported)
    frame_two = get_asset_state(imported.assets, "b.png", 0)
    assert "faction-a" in frame_two.annotations.suppressedFactionIds

    after_nav = set_timeline_index(imported, 1)
    frame_two_after = get_asset_state(after_nav.assets, "b.png", 0)
    assert all(c.factionId != "faction-a" for c in frame_two_after.annotations.countries)


def test_infer_suppressed_factions_skips_empty_frames():
    project = ProjectBody(
        timeline=[
            TimelineEntry(id="t1", filename="a.png", copyIndex=0),
            TimelineEntry(id="t2", filename="b.png", copyIndex=0),
        ],
        assets={
            "a.png": [
                AssetFrameState(
                    annotations=FrameAnnotations(
                        countries=[_country("faction-a", "Alpha", "#448aff")]
                    )
                )
            ],
            "b.png": [AssetFrameState()],
        },
    )
    inferred = infer_suppressed_factions(project)
    frame_two = get_asset_state(inferred.assets, "b.png", 0)
    assert frame_two.annotations.suppressedFactionIds == []
