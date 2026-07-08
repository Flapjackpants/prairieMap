from datetime import datetime

from app.models.project import AssetTarget, FrameDuplicateOptions
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png", "map3.png"])


def test_auto_fill_timeline_dates_every_six_frames():
    project = _sample_project()
    assert len(project.timeline) == 3

    start = datetime(2025, 6, 24, 21, 12)
    result = project_service.auto_fill_timeline_dates(project, start, frames_per_step=6, minutes_per_step=1)

    titles = []
    for entry in result.timeline:
        frame = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
        titles.append(frame.info.dateTitle)

    assert titles[0] == "6/24/25, 9:12pm"
    assert titles[1] == "6/24/25, 9:12pm"
    assert titles[2] == "6/24/25, 9:12pm"


def test_auto_fill_timeline_dates_increments():
    project = _sample_project()
    while len(project.timeline) < 7:
        dup = project_service.duplicate_frame(
            project,
            len(project.timeline) - 1,
            FrameDuplicateOptions(
                duplicateMapImage=True,
                duplicateAnnotations=False,
                duplicateInfoBoard=False,
            ),
            ["map1.png", "map2.png", "map3.png"],
        )
        assert dup is not None
        project = dup

    start = datetime(2025, 6, 24, 21, 12)
    result = project_service.auto_fill_timeline_dates(project, start, frames_per_step=6, minutes_per_step=1)

    titles = []
    for entry in result.timeline:
        frame = project_service.get_asset_state(result.assets, entry.filename, entry.copyIndex)
        titles.append(frame.info.dateTitle)

    assert titles[0] == "6/24/25, 9:12pm"
    assert titles[5] == "6/24/25, 9:12pm"
    assert titles[6] == "6/24/25, 9:13pm"


def _project_with_seven_frames():
    project = _sample_project()
    while len(project.timeline) < 7:
        dup = project_service.duplicate_frame(
            project,
            len(project.timeline) - 1,
            FrameDuplicateOptions(
                duplicateMapImage=True,
                duplicateAnnotations=False,
                duplicateInfoBoard=False,
            ),
            ["map1.png", "map2.png", "map3.png"],
        )
        assert dup is not None
        project = dup
    return project


def _descriptions(project):
    out = []
    for entry in project.timeline:
        frame = project_service.get_asset_state(project.assets, entry.filename, entry.copyIndex)
        out.append(frame.info.description)
    return out


def test_auto_fill_timeline_dates_syncs_event_log_within_same_date():
    project = _project_with_seven_frames()
    # Give each frame a distinct event log so we can observe the sync behaviour.
    for index, entry in enumerate(project.timeline):
        project = project_service.update_frame_info(
            project,
            AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex),
            {"description": f"log-{index}"},
        )

    start = datetime(2025, 6, 24, 21, 12)
    result = project_service.auto_fill_timeline_dates(
        project, start, frames_per_step=6, minutes_per_step=1, sync_event_log=True
    )

    descriptions = _descriptions(result)
    # Frames 0-5 share 9:12pm -> all take frame 0's log; frame 6 is a new minute.
    assert descriptions == ["log-0"] * 6 + ["log-6"]


def test_auto_fill_timeline_dates_leaves_event_log_untouched_by_default():
    project = _project_with_seven_frames()
    for index, entry in enumerate(project.timeline):
        project = project_service.update_frame_info(
            project,
            AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex),
            {"description": f"log-{index}"},
        )

    start = datetime(2025, 6, 24, 21, 12)
    result = project_service.auto_fill_timeline_dates(
        project, start, frames_per_step=6, minutes_per_step=1
    )

    assert _descriptions(result) == [f"log-{i}" for i in range(7)]
