from app.models.project import AssetTarget, DivisionCropRect, DivisionIconPatch, DivisionMarker
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png"])


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


def test_update_division_icon_all_frames():
    project = _sample_project()
    project = project_service.append_recorded_frame(
        project, 0, [_division()], ["map1.png", "map2.png"]
    )
    assert project is not None
    assert len(project.timeline) == 3

    patch = DivisionIconPatch(
        sourceFilename="map2.png",
        crop=DivisionCropRect(x=10, y=10, width=32, height=32),
        size=40,
        name="Alex",
    )
    result = project_service.update_division_icon(
        project, "player-1", patch, "all_frames", None
    )
    assert result is not None

    entry = project.timeline[1]
    frame = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
    div = frame.annotations.divisions[0]
    assert div.name == "Alex"
    assert div.sourceFilename == "map2.png"
    assert div.size == 40
    assert div.crop.x == 10


def test_update_division_icon_current_frame_only():
    project = _sample_project()
    project = project_service.append_recorded_frame(
        project, 0, [_division()], ["map1.png", "map2.png"]
    )
    assert project is not None
    entry = project.timeline[1]
    patch = DivisionIconPatch(name="OnlyHere")
    result = project_service.update_division_icon(
        project,
        "player-1",
        patch,
        "current_frame",
        AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex),
    )
    assert result is not None

    frame0 = project_service.get_asset_state(
        result.assets, project.timeline[0].filename, project.timeline[0].copyIndex
    )
    frame1 = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
    assert frame0.annotations.divisions == []
    assert frame1.annotations.divisions[0].name == "OnlyHere"
