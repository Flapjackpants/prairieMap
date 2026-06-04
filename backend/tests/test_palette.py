from app.models.project import ProjectBody
from app.services.project_service import add_palette_color


def test_add_palette_color_appends_entry():
    project = ProjectBody()
    assert len(project.palette) >= 1
    n_before = len(project.palette)
    updated = add_palette_color(project, "Test Nation", "#aabbcc")
    assert len(updated.palette) == n_before + 1
    assert updated.palette[-1].name == "Test Nation"
    assert updated.palette[-1].hex == "#aabbcc"
