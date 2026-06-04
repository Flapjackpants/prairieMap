from app.services.geometry import apply_territory_transfer, union_all_regions


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
