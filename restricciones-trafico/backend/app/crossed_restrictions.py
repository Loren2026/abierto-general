import json
from math import atan2, cos, radians, sin, sqrt
from typing import Any

from .query import consulta
from .supabase_geometries import fetch_restriction_geometries, supabase_configured


def _iter_positions(coords: Any):
    if isinstance(coords, list):
        if len(coords) >= 2 and all(isinstance(v, (int, float)) for v in coords[:2]):
            yield float(coords[0]), float(coords[1])
        else:
            for item in coords:
                yield from _iter_positions(item)


def _distance_point_to_segment_km(point, a, b) -> float:
    lon, lat = point
    lon1, lat1 = a
    lon2, lat2 = b
    mid_lat = radians((lat + lat1 + lat2) / 3)
    x = lon * 111.32 * cos(mid_lat)
    y = lat * 110.57
    x1 = lon1 * 111.32 * cos(mid_lat)
    y1 = lat1 * 110.57
    x2 = lon2 * 111.32 * cos(mid_lat)
    y2 = lat2 * 110.57
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
    if not points:
        return False
    for point in points:
        for a, b in zip(route_coords, route_coords[1:]):
            if _distance_point_to_segment_km(point, a, b) <= threshold_km:
                return True
    return False


def crossed_restrictions_for_route(route_geometry: dict[str, Any] | None, fecha_salida: str, fecha_llegada: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not supabase_configured():
        return [], {"checked": False, "reason": "Supabase no configurado; no se pudo comprobar cruce real con restriction_geometries"}
    try:
        records = fetch_restriction_geometries(limit=12, confidence=None)
    except Exception as exc:  # noqa: BLE001 - estado honesto para PWA/API
        return [], {"checked": False, "reason": f"No se pudieron leer restriction_geometries de Supabase: {exc}"}

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
        return [], {"checked": True, "reason": "Comprobado contra restriction_geometries: sin cruces geométricos vigentes"}

    candidates = consulta(fecha_salida, fecha_llegada, sorted(set(intersected_roads)))
    filtered = [item for item in candidates if not intersected_ids or str(item.get("id")) in intersected_ids or item.get("via") in intersected_roads]
    return filtered, {"checked": True, "reason": "Comprobado contra restriction_geometries de Supabase y reglas temporales SQLite"}
