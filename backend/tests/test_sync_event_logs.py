from app.models.project import AssetTarget, ProjectDisplaySettings
from app.services import project_service


def _sample_project():
    return project_service.init_from_filenames(["map1.png", "map2.png", "map3.png"])


def _target(project, index):
    entry = project.timeline[index]
    return AssetTarget(filename=entry.filename, copyIndex=entry.copyIndex)


def _descriptions(project):
    out = []
    for entry in project.timeline:
        frame = project_service.get_asset_state(project.assets, entry.filename, entry.copyIndex)
        out.append(frame.info.description)
    return out


def _with_date(project, index, date_title):
    return project_service.update_frame_info(
        project, _target(project, index), {"dateTitle": date_title}
    )


def test_sync_event_logs_by_date_copies_first_frame_of_group():
    project = _sample_project()
    project = _with_date(project, 0, "6/24/25, 9:12pm")
    project = _with_date(project, 1, "6/24/25, 9:12pm")
    project = _with_date(project, 2, "6/24/25, 9:13pm")
    project = project_service.update_frame_info(
        project, _target(project, 0), {"description": "shared log"}
    )
    project = project_service.update_frame_info(
        project, _target(project, 2), {"description": "next minute"}
    )

    result = project_service.sync_event_logs_by_date(project)

    assert _descriptions(result) == ["shared log", "shared log", "next minute"]


def test_sync_event_logs_by_date_ignores_frames_without_a_date():
    project = _sample_project()
    project = project_service.update_frame_info(
        project, _target(project, 0), {"description": "log-0"}
    )
    project = project_service.update_frame_info(
        project, _target(project, 1), {"description": "log-1"}
    )

    result = project_service.sync_event_logs_by_date(project)

    assert _descriptions(result) == ["log-0", "log-1", ""]


def test_update_frame_info_propagates_when_setting_enabled():
    project = _sample_project()
    project = _with_date(project, 0, "6/24/25, 9:12pm")
    project = _with_date(project, 1, "6/24/25, 9:12pm")
    project = _with_date(project, 2, "6/24/25, 9:13pm")
    project = project.model_copy(
        update={"displaySettings": ProjectDisplaySettings(syncEventLogsByDate=True)}
    )

    project = project_service.update_frame_info(
        project, _target(project, 1), {"description": "edited on frame 1"}
    )

    assert _descriptions(project) == ["edited on frame 1", "edited on frame 1", ""]


def test_update_frame_info_does_not_propagate_when_setting_disabled():
    project = _sample_project()
    project = _with_date(project, 0, "6/24/25, 9:12pm")
    project = _with_date(project, 1, "6/24/25, 9:12pm")

    project = project_service.update_frame_info(
        project, _target(project, 1), {"description": "only me"}
    )

    assert _descriptions(project) == ["", "only me", ""]
