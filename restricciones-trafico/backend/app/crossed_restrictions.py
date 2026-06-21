import json
from math import cos, radians, sqrt
from typing import Any

from .query import consulta
from .supabase_geometries import fetch_restriction_geometries_for_bbox, supabase_configured

KM_PER_DEG_LAT = 110.57
KM_PER_DEG_LON = 111.32


def _iter_positions(coords: Any):
    if isinstance(coords, list):
        if len(coords) >= 2 and all(isinstance(v, (int, float)) for v in coords[:2]):
            yield float(coords[0]), float(coords[1])
        else:
            for item in coords:
                yield from _iter_positions(item)


def _bbox(points: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if not points:
        return None
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    return min(lons), min(lats), max(lons), max(lats)


def _expand_bbox_km(bbox: tuple[float, float, float, float], threshold_km: float) -> tuple[float, float, float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    mid_lat = (min_lat + max_lat) / 2
    delta_lat = threshold_km / KM_PER_DEG_LAT
    delta_lon = threshold_km / (KM_PER_DEG_LON * max(cos(radians(mid_lat)), 0.01))
    return min_lon - delta_lon, min_lat - delta_lat, max_lon + delta_lon, max_lat + delta_lat


def _segment_bbox(a, b) -> tuple[float, float, float, float]:
    return min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])


def _bbox_intersects(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def _distance_point_to_segment_km(point, a, b) -> float:
    lon, lat = point
    lon1, lat1 = a
    lon2, lat2 = b
    mid_lat = radians((lat + lat1 + lat2) / 3)
    x = lon * KM_PER_DEG_LON * cos(mid_lat)
    y = lat * KM_PER_DEG_LAT
    x1 = lon1 * KM_PER_DEG_LON * cos(mid_lat)
    y1 = lat1 * KM_PER_DEG_LAT
    x2 = lon2 * KM_PER_DEG_LON * cos(mid_lat)
    y2 = lat2 * KM_PER_DEG_LAT
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return sqrt((x - x1) ** 2 + (y - y1) ** 2)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    proj_x, proj_y = x1 + t * dx, y1 + t * dy
    return sqrt((x - proj_x) ** 2 + (y - proj_y) ** 2)


def _route_intersects_geometry(route_geometry: dict[str, Any] | None, restriction_geometry: dict[str, Any], threshold_km: float = 0.25) -> bool:
    route_coords = (route_geometry or {}).get("coordinates") or []
    if len(route_coords) < 2:
        return False
    points = list(_iter_positions(restriction_geometry.get("coordinates")))
    geometry_bbox = _bbox(points)
    if not geometry_bbox:
        return False
    expanded_geometry_bbox = _expand_bbox_km(geometry_bbox, threshold_km)
    route_bbox = _bbox(route_coords)
    if not route_bbox or not _bbox_intersects(route_bbox, expanded_geometry_bbox):
        return False

    relevant_segments = [(a, b) for a, b in zip(route_coords, route_coords[1:]) if _bbox_intersects(_segment_bbox(a, b), expanded_geometry_bbox)]
    if not relevant_segments:
        return False

    for point in points:
        point_bbox = _expand_bbox_km((point[0], point[1], point[0], point[1]), threshold_km)
        for a, b in relevant_segments:
            if not _bbox_intersects(_segment_bbox(a, b), point_bbox):
                continue
            if _distance_point_to_segment_km(point, a, b) <= threshold_km:
                return True
    return False


def crossed_restrictions_for_route(route_geometry: dict[str, Any] | None, fecha_salida: str, fecha_llegada: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not supabase_configured():
        return [], {"checked": False, "geometry_count": 0, "reason": "Supabase no configurado; no se pudo comprobar cruce real con restriction_geometries"}
    route_coords = list(_iter_positions((route_geometry or {}).get("coordinates") or []))
    route_bbox = _bbox(route_coords)
    if not route_bbox:
        return [], {"checked": False, "geometry_count": 0, "reason": "Ruta sin geometría utilizable; no se pudo comprobar cruce real con restriction_geometries"}

    corridor_km = 5.0
    try:
        records, geometry_count_total = fetch_restriction_geometries_for_bbox(route_bbox, confidence=None, margin_km=corridor_km)
    except Exception as exc:  # noqa: BLE001 - estado honesto para PWA/API
        return [], {"checked": False, "geometry_count": 0, "reason": f"No se pudieron leer restriction_geometries de Supabase: {exc}"}

    geometry_count = len(records)
    intersected_roads: list[str] = []
    intersected_ids: set[str] = set()
    for record in records:
        raw = record.get("buffer_geojson") or record.get("geometry_geojson")
        if not raw:
            continue
        try:
            geometry = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            continue
        if _route_intersects_geometry(route_geometry, geometry):
            road = record.get("road_normalized")
            if road:
                intersected_roads.append(road)
            if record.get("restriction_id"):
                intersected_ids.add(str(record["restriction_id"]))

    if not intersected_roads and not intersected_ids:
        return [], {"checked": True, "geometry_count": geometry_count, "geometry_count_total_cached": geometry_count_total, "geometry_count_corridor": geometry_count, "corridor_km": corridor_km, "reason": f"Comprobado contra {geometry_count} geometrías del corredor ±{corridor_km:g} km (total cacheado: {geometry_count_total}); sin cruces geométricos"}

    candidates = consulta(fecha_salida, fecha_llegada, sorted(set(intersected_roads)))
    filtered = [item for item in candidates if not intersected_ids or str(item.get("id")) in intersected_ids or item.get("via") in intersected_roads]
    return filtered, {"checked": True, "geometry_count": geometry_count, "geometry_count_total_cached": geometry_count_total, "geometry_count_corridor": geometry_count, "corridor_km": corridor_km, "reason": f"Comprobado contra {geometry_count} geometrías del corredor ±{corridor_km:g} km (total cacheado: {geometry_count_total}) y reglas temporales SQLite"}
