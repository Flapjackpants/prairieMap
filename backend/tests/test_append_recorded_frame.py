from app.models.project import DivisionCropRect, DivisionMarker
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png"])


def test_append_recorded_frame_inserts_with_divisions():
    project = _sample_project()
    divisions = [
        DivisionMarker(
            id="player-1",
            name="Steve",
            x=100,
            y=200,
            size=28,
            sourceFilename="map1.png",
            crop=DivisionCropRect(x=0, y=0, width=64, height=64),
        )
    ]
    result = project_service.append_recorded_frame(project, 0, divisions, ["map1.png", "map2.png"])
    assert result is not None
    assert len(result.timeline) == len(project.timeline) + 1
    assert result.currentTimelineIndex == 1
    entry = result.timeline[1]
    frame = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
    assert len(frame.annotations.divisions) == 1
    assert frame.annotations.divisions[0].name == "Steve"
    assert frame.annotations.divisions[0].x == 100
