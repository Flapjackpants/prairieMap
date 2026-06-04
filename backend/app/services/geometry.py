from __future__ import annotations

import math
import uuid
from typing import Any

from shapely import make_valid
from shapely.geometry import Polygon
from shapely.ops import unary_union

from app.models.project import CountryLabelSettings, CountryTerritory, LabelSpine

MIN_REGION_AREA = 80
ANCHOR_EPS = 2.0
LABEL_MIN_FONT = 9
LABEL_MAX_FONT = 48
LETTER_SPACING_FACTOR = 0.68
SPINE_LENGTH_FACTOR = 0.48
SPINE_MINOR_INSET = 0.38
ARC_SAMPLES = 48
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


def _point_in_ring(point: dict[str, float], ring: PolygonRing) -> bool:
    inside = False
    x, y = point["x"], point["y"]
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xinters = (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1
            if x < xinters:
                inside = not inside
    return inside


def exterior_rings_only(regions: list[PolygonRing]) -> list[PolygonRing]:
    valid = [r for r in regions if len(r) >= 3 and polygon_area(r) >= 1]
    exteriors: list[PolygonRing] = []
    for ring in valid:
        center = polygon_centroid(ring)
        area = polygon_area(ring)
        is_hole = False
        for other in valid:
            if other is ring:
                continue
            if polygon_area(other) > area and _point_in_ring(center, other):
                is_hole = True
                break
        if not is_hole:
            exteriors.append(ring)
    return exteriors


def _compute_principal_axis(ring: PolygonRing) -> tuple[float, float, float, float]:
    center = polygon_centroid(ring)
    xx = yy = xy = 0.0
    for x, y in ring:
        px, py = x - center["x"], y - center["y"]
        xx += px * px
        yy += py * py
        xy += px * py
    n = max(len(ring), 1)
    xx /= n
    yy /= n
    xy /= n
    trace = xx + yy
    det = xx * yy - xy * xy
    disc = max(0.0, (trace / 2) ** 2 - det)
    lambda1 = trace / 2 + math.sqrt(disc)
    dx, dy = xy, lambda1 - xx
    length = math.hypot(dx, dy)
    if length < 1e-6:
        dx, dy = 1.0, 0.0
    else:
        dx, dy = dx / length, dy / length
    perp_x, perp_y = -dy, dx
    min_maj = max_maj = min_min = max_min = None
    for x, y in ring:
        px, py = x - center["x"], y - center["y"]
        maj = px * dx + py * dy
        min_ = px * perp_x + py * perp_y
        min_maj = maj if min_maj is None else min(min_maj, maj)
        max_maj = maj if max_maj is None else max(max_maj, maj)
        min_min = min_ if min_min is None else min(min_min, min_)
        max_min = min_ if max_min is None else max(max_min, min_)
    span = max((max_maj or 0) - (min_maj or 0), 1.0)
    minor = max((max_min or 0) - (min_min or 0), 1.0)
    return dx, dy, span, minor


def _build_spine(ring: PolygonRing, length_factor: float = SPINE_LENGTH_FACTOR) -> LabelSpine:
    center = polygon_centroid(ring)
    dx, dy, span, minor = _compute_principal_axis(ring)
    half_len = min((span * length_factor) / 2, (minor * SPINE_MINOR_INSET) / 2)
    perp_x, perp_y = -dy, dx
    bulge = minor * 0.05
    return LabelSpine(
        x1=center["x"] - dx * half_len,
        y1=center["y"] - dy * half_len,
        cx=center["x"] + perp_x * bulge,
        cy=center["y"] + perp_y * bulge,
        x2=center["x"] + dx * half_len,
        y2=center["y"] + dy * half_len,
    )


def _quad_point(spine: LabelSpine, t: float) -> tuple[float, float]:
    u = 1 - t
    x = u * u * spine.x1 + 2 * u * t * spine.cx + t * t * spine.x2
    y = u * u * spine.y1 + 2 * u * t * spine.cy + t * t * spine.y2
    return x, y


def _quad_tangent(spine: LabelSpine, t: float) -> tuple[float, float]:
    u = 1 - t
    tx = 2 * u * (spine.cx - spine.x1) + 2 * t * (spine.x2 - spine.cx)
    ty = 2 * u * (spine.cy - spine.y1) + 2 * t * (spine.y2 - spine.cy)
    return tx, ty


def _build_arc_table(spine: LabelSpine) -> tuple[list[float], float]:
    lengths = [0.0]
    prev_x, prev_y = _quad_point(spine, 0)
    for i in range(1, ARC_SAMPLES + 1):
        t = i / ARC_SAMPLES
        x, y = _quad_point(spine, t)
        lengths.append(lengths[-1] + math.hypot(x - prev_x, y - prev_y))
        prev_x, prev_y = x, y
    return lengths, lengths[-1]


def _point_at_arc_length(
    spine: LabelSpine, arc_len: float, table: tuple[list[float], float]
) -> tuple[float, float, float]:
    lengths, total = table
    target = _clamp(arc_len, 0, total)
    lo, hi = 0, ARC_SAMPLES
    while lo < hi:
        mid = (lo + hi) // 2
        if lengths[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    len0, len1 = lengths[i - 1], lengths[i]
    seg = len1 - len0 or 1.0
    frac = (target - len0) / seg
    t = (i - 1 + frac) / ARC_SAMPLES
    x, y = _quad_point(spine, t)
    return x, y, t


def _tangent_degrees_at(spine: LabelSpine, t: float) -> float:
    tx, ty = _quad_tangent(spine, _clamp(t, 0, 1))
    return math.degrees(math.atan2(ty, tx))


def _reverse_spine(spine: LabelSpine) -> LabelSpine:
    return LabelSpine(
        x1=spine.x2,
        y1=spine.y2,
        cx=spine.cx,
        cy=spine.cy,
        x2=spine.x1,
        y2=spine.y1,
    )


def _is_spine_upside_down(spine: LabelSpine) -> bool:
    deg = _tangent_degrees_at(spine, 0.5)
    while deg > 180:
        deg -= 360
    while deg < -180:
        deg += 360
    return deg > 90 or deg < -90


def _orient_spine_for_reading(spine: LabelSpine) -> LabelSpine:
    return _reverse_spine(spine) if _is_spine_upside_down(spine) else spine


def compute_curved_label_for_region(name: str, ring: PolygonRing) -> dict[str, Any]:
    bounds = combined_bounds([ring])
    area = polygon_area(ring)
    span = max(bounds["width"], bounds["height"], 1)
    font_size = _clamp((area**0.5) * 0.08 + span * 0.018, LABEL_MIN_FONT, LABEL_MAX_FONT)
    letter_spacing = font_size * LETTER_SPACING_FACTOR
    spine = _orient_spine_for_reading(_build_spine(ring))
    table = _build_arc_table(spine)
    mid_x, mid_y, _ = _point_at_arc_length(spine, table[1] / 2, table)
    return {
        "x": mid_x,
        "y": mid_y,
        "fontSize": font_size,
        "letterSpacing": letter_spacing,
        "spine": spine.model_dump(),
        "rotation": _tangent_degrees_at(spine, 0.5),
    }


def compute_region_labels(name: str, regions: list[PolygonRing]) -> list[dict[str, Any]]:
    return [
        compute_curved_label_for_region(name, ring) for ring in exterior_rings_only(regions)
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
                rotation=primary.get("rotation", 0) if primary else 0,
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
