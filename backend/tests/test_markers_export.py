from app.models.project import CityMarker, CountryLabelSettings, CountryTerritory, DivisionCropRect, DivisionMarker
from app.services.export_schema import asset_state_to_export, export_to_asset_state
from app.models.project import AssetFrameState, FrameAnnotations, FrameInfo


def test_markers_roundtrip_export():
    state = AssetFrameState(
        annotations=FrameAnnotations(
            countries=[
                CountryTerritory(
                    id="c1",
                    factionId="f",
                    name="A",
                    color="#f00",
                    labelSettings=CountryLabelSettings(),
                    regionLabels=[],
                    regions=[],
                )
            ],
            cities=[CityMarker(id="city1", x=10, y=20, name="Paris")],
            divisions=[
                DivisionMarker(
                    id="div1",
                    x=100,
                    y=200,
                    size=48,
                    sourceFilename="map.png",
                    crop=DivisionCropRect(x=0, y=0, width=32, height=32),
                )
            ],
        ),
        info=FrameInfo(),
    )
    exported = asset_state_to_export(state)
    assert exported["drawings"]["cities"][0]["name"] == "Paris"
    assert exported["drawings"]["divisions"][0]["size"] == 48
    restored = export_to_asset_state(exported)
    assert len(restored.annotations.cities) == 1
    assert len(restored.annotations.divisions) == 1
