from app.models.project import ProjectBody
from app.services.project_service import add_palette_color, update_faction_metadata


def test_add_palette_color_appends_entry():
    project = ProjectBody()
    assert len(project.palette) >= 1
    n_before = len(project.palette)
    updated = add_palette_color(project, "Test Nation", "#aabbcc")
    assert len(updated.palette) == n_before + 1
    assert updated.palette[-1].name == "Test Nation"
    assert updated.palette[-1].hex == "#aabbcc"
    assert updated.palette[-1].flagFilename is None


def test_update_faction_metadata_sets_flag():
    project = ProjectBody()
    faction_id = project.palette[0].id
    updated = update_faction_metadata(
        project,
        faction_id,
        None,
        None,
        "france_flag.png",
        set_flag=True,
    )
    assert updated.palette[0].flagFilename == "france_flag.png"


def test_update_faction_metadata_clears_flag():
    project = ProjectBody()
    faction_id = project.palette[0].id
    with_flag = update_faction_metadata(
        project,
        faction_id,
        None,
        None,
        "france_flag.png",
        set_flag=True,
    )
    cleared = update_faction_metadata(
        with_flag,
        faction_id,
        None,
        None,
        None,
        set_flag=True,
    )
    assert cleared.palette[0].flagFilename is None
