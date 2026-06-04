from __future__ import annotations

import uuid
from typing import Any

from shapely import make_valid
from shapely.geometry import Polygon
from shapely.ops import unary_union

from app.models.project import CountryLabelSettings, CountryTerritory

MIN_REGION_AREA = 80
ANCHOR_EPS = 2.0
PolygonRing = list[list[float]]


def _points_equal(a: list[float], b: list[float], eps: float = ANCHOR_EPS) -> bool:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 <= eps


def _remove_point_from_ring(ring: PolygonRing, point: list[float], eps: float) -> PolygonRing:
    return [[x, y] for x, y in ring if not _points_equal([x, y], point, eps)]


def purge_points_from_other_factions(
    countries: list[CountryTerritory],
    points: list[list[float]],
    active_faction_id: str,
    eps: float = ANCHOR_EPS,
) -> list[CountryTerritory]:
    """Remove anchor coordinates from every nation except the active faction."""
    result: list[CountryTerritory] = []
    for country in countries:
        if country.factionId == active_faction_id:
            result.append(country)
            continue
        new_regions: list[PolygonRing] = []
        for ring in country.regions:
            updated = ring
            for pt in points:
                updated = _remove_point_from_ring(updated, pt, eps)
            if len(updated) >= 3:
                new_regions.append(updated)
        if not new_regions:
            continue
        result.append(recompute_country_labels(country.model_copy(update={"regions": new_regions})))
    return result


def claim_anchor_at_point(
    countries: list[CountryTerritory],
    country_id: str,
    x: float,
    y: float,
    eps: float = ANCHOR_EPS,
) -> list[CountryTerritory]:
    """Remove the anchor from the selected nation only (other nations unchanged)."""
    point = [x, y]
    result: list[CountryTerritory] = []
    for country in countries:
        if country.id != country_id:
            result.append(country)
            continue
        new_regions: list[PolygonRing] = []
        for ring in country.regions:
            updated = _remove_point_from_ring(ring, point, eps)
            if len(updated) >= 3:
                new_regions.append(updated)
        if not new_regions:
            continue
        result.append(recompute_country_labels(country.model_copy(update={"regions": new_regions})))
    return result


def remove_vertex_from_country(
    countries: list[CountryTerritory],
    country_id: str,
    ring_index: int,
    vertex_index: int,
) -> list[CountryTerritory]:
    updated: list[CountryTerritory] = []
    for country in countries:
        if country.id != country_id:
            updated.append(country)
            continue
        new_regions: list[PolygonRing] = []
        for ri, ring in enumerate(country.regions):
            if ri != ring_index:
                new_regions.append(ring)
                continue
            if vertex_index < 0 or vertex_index >= len(ring):
                new_regions.append(ring)
                continue
            trimmed = [list(pt) for pt in ring[:vertex_index] + ring[vertex_index + 1 :]]
            if len(trimmed) >= 3:
                new_regions.append(trimmed)
        if not new_regions:
            continue
        updated.append(recompute_country_labels(country.model_copy(update={"regions": new_regions})))
    return updated


def move_vertex_on_country(
    countries: list[CountryTerritory],
    country_id: str,
    ring_index: int,
    vertex_index: int,
    x: float,
    y: float,
) -> list[CountryTerritory]:
    updated: list[CountryTerritory] = []
    for country in countries:
        if country.id != country_id:
            updated.append(country)
            continue
        new_regions: list[PolygonRing] = []
        for ri, ring in enumerate(country.regions):
            if ri != ring_index:
                new_regions.append(ring)
                continue
            if vertex_index < 0 or vertex_index >= len(ring):
                new_regions.append(ring)
                continue
            moved = [[float(px), float(py)] for px, py in ring]
            moved[vertex_index] = [x, y]
            if len(moved) >= 3:
                new_regions.append(moved)
        if not new_regions:
            continue
        updated.append(recompute_country_labels(country.model_copy(update={"regions": new_regions})))
    return updated


def polygon_area(ring: PolygonRing) -> float:
    if len(ring) < 3:
        return 0.0
    area = 0.0
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def polygon_centroid(ring: PolygonRing) -> dict[str, float]:
    n = len(ring)
    if n < 3:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return {
            "x": sum(xs) / (n or 1),
            "y": sum(ys) / (n or 1),
        }
    cx = cy = a = 0.0
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a *= 0.5
    if abs(a) < 1e-6:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return {"x": sum(xs) / n, "y": sum(ys) / n}
    return {"x": cx / (6 * a), "y": cy / (6 * a)}


def combined_bounds(regions: list[PolygonRing]) -> dict[str, float]:
    points = [p for r in regions for p in r]
    if not points:
        return {"minX": 0, "minY": 0, "maxX": 0, "maxY": 0, "width": 0, "height": 0}
    min_x = min(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_x = max(p[0] for p in points)
    max_y = max(p[1] for p in points)
    return {
        "minX": min_x,
        "minY": min_y,
        "maxX": max_x,
        "maxY": max_y,
        "width": max_x - min_x,
        "height": max_y - min_y,
    }


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def compute_flat_label_for_region(name: str, ring: PolygonRing) -> dict[str, float]:
    bounds = combined_bounds([ring])
    area = polygon_area(ring)
    center = polygon_centroid(ring)
    span = max(bounds["width"], bounds["height"], 1)
    font_size = _clamp((area**0.5) * 0.09 + span * 0.022, 9, 48)
    char_count = max(len(name), 1)
    letter_spacing = 0.0
    if bounds["width"] > font_size * char_count * 0.55:
        letter_spacing = _clamp(
            (bounds["width"] - font_size * char_count * 0.5) / max(char_count - 1, 1),
            0,
            font_size * 0.2,
        )
    return {
        "x": center["x"],
        "y": center["y"],
        "fontSize": font_size,
        "letterSpacing": letter_spacing,
    }


def compute_region_labels(name: str, regions: list[PolygonRing]) -> list[dict[str, float]]:
    return [
        compute_flat_label_for_region(name, ring)
        for ring in regions
        if len(ring) >= 3 and polygon_area(ring) >= 1
    ]


def recompute_country_labels(country: CountryTerritory) -> CountryTerritory:
    if not country.regions:
        return country.model_copy(update={"regionLabels": []})
    region_labels = compute_region_labels(country.name, country.regions)
    primary = region_labels[0] if region_labels else None
    return country.model_copy(
        update={
            "regionLabels": region_labels,
            "labelSettings": CountryLabelSettings(
                fontSize=primary["fontSize"] if primary else 14,
                rotation=0,
                letterSpacing=primary["letterSpacing"] if primary else 0,
            ),
        }
    )


def _ring_to_polygon(ring: PolygonRing) -> Polygon | None:
    if len(ring) < 3:
        return None
    try:
        poly = Polygon([(p[0], p[1]) for p in ring])
        if not poly.is_valid:
            poly = make_valid(poly)
        if poly.is_empty or poly.area < 1e-6:
            return None
        return poly
    except Exception:
        return None


def _polygon_to_rings(geom: Any) -> list[PolygonRing]:
    rings: list[PolygonRing] = []
    if geom is None or geom.is_empty:
        return rings

    def add_poly(poly: Polygon) -> None:
        if poly.is_empty:
            return
        ext = list(poly.exterior.coords)[:-1]
        ring = [[float(x), float(y)] for x, y in ext]
        if polygon_area(ring) >= MIN_REGION_AREA:
            rings.append(ring)
        for interior in poly.interiors:
            hole = [[float(x), float(y)] for x, y in interior.coords][:-1]
            if len(hole) >= 3 and polygon_area(hole) >= MIN_REGION_AREA:
                rings.append(hole)

    if geom.geom_type == "Polygon":
        add_poly(geom)
    elif geom.geom_type == "MultiPolygon":
        for g in geom.geoms:
            add_poly(g)
    elif geom.geom_type == "GeometryCollection":
        for g in geom.geoms:
            rings.extend(_polygon_to_rings(g))
    return rings


def union_all_regions(regions: list[PolygonRing]) -> list[PolygonRing]:
    valid = [r for r in regions if len(r) >= 3]
    if not valid:
        return []
    if len(valid) == 1:
        return valid
    try:
        polys = [_ring_to_polygon(r) for r in valid]
        polys = [p for p in polys if p is not None]
        if not polys:
            return valid
        merged = unary_union(polys)
        result = _polygon_to_rings(merged)
        return result if result else valid
    except Exception:
        return valid


def subtract_polygon(target: PolygonRing, cutter: PolygonRing) -> list[PolygonRing]:
    if len(target) < 3 or len(cutter) < 3:
        return [target] if len(target) >= 3 else []
    try:
        t = _ring_to_polygon(target)
        c = _ring_to_polygon(cutter)
        if t is None:
            return []
        if c is None:
            return [target]
        diff = t.difference(c)
        rings = _polygon_to_rings(diff)
        return rings if rings else []
    except Exception:
        return [target]


def apply_territory_transfer(
    countries: list[CountryTerritory],
    new_ring: PolygonRing,
    active_faction_id: str,
    faction_name: str,
    color: str,
    target_country_id: str | None = None,
) -> list[CountryTerritory]:
    updated: list[CountryTerritory] = []

    for country in countries:
        if target_country_id:
            if country.id == target_country_id:
                updated.append(country)
                continue
        elif country.factionId == active_faction_id:
            updated.append(country)
            continue
        new_regions: list[PolygonRing] = []
        for region in country.regions:
            new_regions.extend(subtract_polygon(region, new_ring))
        if not new_regions:
            continue
        updated.append(recompute_country_labels(country.model_copy(update={"regions": new_regions})))

    if target_country_id:
        active_idx = next((i for i, c in enumerate(updated) if c.id == target_country_id), -1)
    else:
        active_idx = next((i for i, c in enumerate(updated) if c.factionId == active_faction_id), -1)
    if active_idx < 0:
        merged = union_all_regions([new_ring])
        updated.append(
            recompute_country_labels(
                CountryTerritory(
                    id=str(uuid.uuid4()),
                    factionId=active_faction_id,
                    name=faction_name.upper(),
                    color=color,
                    labelSettings=CountryLabelSettings(
                        fontSize=14, rotation=0, letterSpacing=0
                    ),
                    regionLabels=[],
                    regions=merged,
                )
            )
        )
        active_idx = len(updated) - 1
    else:
        merged = union_all_regions([*updated[active_idx].regions, new_ring])
        updated[active_idx] = recompute_country_labels(
            updated[active_idx].model_copy(
                update={
                    "name": faction_name.upper(),
                    "color": color,
                    "regions": merged,
                }
            )
        )

    return updated
