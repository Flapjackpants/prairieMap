from app.models.project import AssetTarget, DivisionCropRect, DivisionMarker
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png", "map3.png"])


def _division(div_id: str = "player-1", name: str = "Steve") -> DivisionMarker:
    return DivisionMarker(
        id=div_id,
        name=name,
        x=100,
        y=200,
        size=28,
        sourceFilename="map1.png",
        crop=DivisionCropRect(x=0, y=0, width=64, height=64),
    )


def test_kill_division_removes_from_current_and_future_only():
    project = _sample_project()
    project = project_service.append_recorded_frame(
        project, 0, [_division()], ["map1.png", "map2.png", "map3.png"]
    )
    assert project is not None
    project = project_service.append_recorded_frame(
        project, 1, [_division()], ["map1.png", "map2.png", "map3.png"]
    )
    assert project is not None
    assert len(project.timeline) == 3

    project = project.model_copy(update={"currentTimelineIndex": 1})
    result = project_service.remove_division(
        project, "player-1", "current_and_future", None, from_timeline_index=1
    )
    assert result is not None

    frame0 = project_service.get_asset_state(
        result.assets, project.timeline[0].filename, project.timeline[0].copyIndex
    )
    frame1 = project_service.get_asset_state(
        result.assets, project.timeline[1].filename, project.timeline[1].copyIndex
    )
    frame2 = project_service.get_asset_state(
        result.assets, project.timeline[2].filename, project.timeline[2].copyIndex
    )
    assert len(frame0.annotations.divisions) == 1
    assert frame0.annotations.divisions[0].id == "player-1"
    assert frame1.annotations.divisions == []
    assert frame2.annotations.divisions == []


def test_remove_division_current_frame_only():
    project = _sample_project()
    project = project_service.append_recorded_frame(
        project, 0, [_division()], ["map1.png", "map2.png", "map3.png"]
    )
    assert project is not None
    project = project_service.append_recorded_frame(
        project, 0, [_division()], ["map1.png", "map2.png", "map3.png"]
    )
    assert project is not None
    entry = project.timeline[1]
    result = project_service.remove_division(
        project,
        "player-1",
        "current_frame",
        AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex),
    )
    assert result is not None

    frame0 = project_service.get_asset_state(
        result.assets, project.timeline[0].filename, project.timeline[0].copyIndex
    )
    frame1 = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
    frame2 = project_service.get_asset_state(
        result.assets, project.timeline[2].filename, project.timeline[2].copyIndex
    )
    assert len(frame0.annotations.divisions) == 1
    assert frame1.annotations.divisions == []
    assert len(frame2.annotations.divisions) == 1
