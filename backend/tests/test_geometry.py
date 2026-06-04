from app.services.geometry import (
    apply_territory_transfer,
    claim_anchor_at_point,
    polygon_area,
    subtract_polygon,
    union_all_regions,
)
from app.models.project import CountryTerritory, CountryLabelSettings


def test_union_two_squares():
    a = [[0, 0], [10, 0], [10, 10], [0, 10]]
    b = [[5, 5], [15, 5], [15, 15], [5, 15]]
    merged = union_all_regions([a, b])
    assert len(merged) >= 1
    assert sum(len(r) for r in merged) >= 4


def test_territory_transfer_creates_faction():
    countries = apply_territory_transfer(
        [],
        [[0, 0], [50, 0], [50, 50], [0, 50]],
        "faction-a",
        "Alpha",
        "#ff0000",
    )
    assert len(countries) == 1
    assert countries[0].factionId == "faction-a"
    assert len(countries[0].regions) >= 1


def test_subtract_leaves_hole_ring_for_frame():
    target = [[0, 0], [100, 0], [100, 100], [0, 100]]
    cutter = [[30, 30], [70, 30], [70, 70], [30, 70]]
    rings = subtract_polygon(target, cutter)
    assert len(rings) == 2


def test_territory_transfer_subtracts_overlap_from_other_faction():
    nation_b = CountryTerritory(
        id="b",
        factionId="faction-b",
        name="B",
        color="#0000ff",
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[[[0, 0], [100, 0], [100, 100], [0, 100]]],
    )
    new_ring = [[30, 30], [70, 30], [70, 70], [30, 70]]
    result = apply_territory_transfer([nation_b], new_ring, "faction-a", "A", "#ff0000")
    b_out = next(c for c in result if c.factionId == "faction-b")
    a_out = next(c for c in result if c.factionId == "faction-a")
    assert len(b_out.regions) == 2
    assert polygon_area(a_out.regions[0]) == 1600


def test_transfer_merges_into_target_country_not_sibling_faction():
    """Two countries same faction: new land merges into target id only."""
    left = CountryTerritory(
        id="left",
        factionId="faction-a",
        name="NATION 1",
        color="#f0f",
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[[[0, 0], [50, 0], [50, 100], [0, 100]]],
    )
    right = CountryTerritory(
        id="right",
        factionId="faction-a",
        name="NATION 1",
        color="#f00",
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[[[50, 0], [100, 0], [100, 100], [50, 100]]],
    )
    extension = [[50, 0], [80, 0], [80, 100], [50, 100]]
    result = apply_territory_transfer(
        [left, right],
        extension,
        "faction-a",
        "NATION 1",
        "#f00",
        target_country_id="right",
    )
    assert len(result) == 2
    merged_right = next(c for c in result if c.id == "right")
    assert len(merged_right.regions) >= 1
    left_out = next(c for c in result if c.id == "left")
    assert len(left_out.regions) >= 1


def test_claim_anchor_removes_only_from_selected_country():
    square = [[0, 0], [100, 0], [100, 100], [0, 100]]
    nation_a = CountryTerritory(
        id="a",
        factionId="faction-a",
        name="A",
        color="#ff0000",
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[square],
    )
    nation_b = CountryTerritory(
        id="b",
        factionId="faction-b",
        name="B",
        color="#0000ff",
        labelSettings=CountryLabelSettings(),
        regionLabels=[],
        regions=[square],
    )
    result = claim_anchor_at_point([nation_a, nation_b], "a", 100, 0)
    assert len(result) == 2
    assert len(result[0].regions[0]) == 3
    assert len(result[1].regions[0]) == 4
