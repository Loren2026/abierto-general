import json
import os
import time
import urllib.parse
import urllib.request
from math import cos, radians
from typing import Any

ORS_AVOID_MAX_AREA_KM2 = 200.0
ORS_AVOID_MAX_EXTENT_KM = 20.0
CACHE_TTL_SECONDS = 300

_cache: dict[str, Any] = {"expires_at": 0.0, "records": None}


def supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def _supabase_get(params: dict[str, str], *, timeout: int = 20) -> list[dict[str, Any]]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas")
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/restriction_geometries?{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_restriction_geometries(limit: int = 12, confidence: str | None = None) -> list[dict[str, Any]]:
    cache_key = f"records:{confidence or 'all'}:{limit}"
    cached = _cache.get(cache_key)
    if cached is not None and time.time() < float(_cache.get("expires_at") or 0):
        return cached
    params = {
        "select": "id,restriction_id,road_normalized,buffer_geojson,geometry_geojson,confidence",
        "limit": str(limit),
    }
    if confidence:
        params["confidence"] = f"eq.{confidence}"
    records = _supabase_get(params)
    _cache[cache_key] = records
    _cache["expires_at"] = time.time() + CACHE_TTL_SECONDS
    return records


def fetch_all_restriction_geometries(confidence: str | None = None, page_size: int = 1000) -> list[dict[str, Any]]:
    cache_key = f"records:{confidence or 'all'}:all"
    cached = _cache.get(cache_key)
    if cached is not None and time.time() < float(_cache.get("expires_at") or 0):
        return cached
    records: list[dict[str, Any]] = []
    offset = 0
    while True:
        params = {
            "select": "id,restriction_id,road_normalized,buffer_geojson,geometry_geojson,confidence",
            "limit": str(page_size),
            "offset": str(offset),
            "order": "id.asc",
        }
        if confidence:
            params["confidence"] = f"eq.{confidence}"
        batch = _supabase_get(params, timeout=30)
        records.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    _cache[cache_key] = records
    _cache["expires_at"] = time.time() + CACHE_TTL_SECONDS
    return records


def fetch_restriction_geometries_for_bbox(bbox: tuple[float, float, float, float], confidence: str | None = None, margin_km: float = 5.0) -> tuple[list[dict[str, Any]], int]:
    records = fetch_all_restriction_geometries(confidence=confidence)
    corridor_bbox = _expand_bbox_km(bbox, margin_km)
    filtered: list[dict[str, Any]] = []
    for record in records:
        raw = record.get("buffer_geojson") or record.get("geometry_geojson")
        if not raw:
            continue
        try:
            geometry = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            continue
        if not isinstance(geometry, dict):
            continue
        geometry_bbox = _geometry_bbox(geometry)
        if geometry_bbox and _bbox_intersects(corridor_bbox, geometry_bbox):
            filtered.append(record)
    return filtered, len(records)


def fetch_high_confidence_geometries(limit: int = 9) -> list[dict[str, Any]]:
    return fetch_restriction_geometries(limit=limit, confidence="alta")


def _iter_positions(coords: Any):
    if isinstance(coords, list):
        if len(coords) >= 2 and all(isinstance(v, (int, float)) for v in coords[:2]):
            yield float(coords[0]), float(coords[1])
        else:
            for item in coords:
                yield from _iter_positions(item)


def _bbox_km(geometry: dict[str, Any]) -> tuple[float, float, float]:
    points = list(_iter_positions(geometry.get("coordinates")))
    if not points:
        return 0.0, 0.0, 0.0
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    min_lon, max_lon, min_lat, max_lat = min(lons), max(lons), min(lats), max(lats)
    mid_lat = (min_lat + max_lat) / 2
    width = abs(max_lon - min_lon) * 111.32 * max(cos(radians(mid_lat)), 0.01)
    height = abs(max_lat - min_lat) * 110.57
    return width, height, width * height


def _split_polygon_to_extent(geometry: dict[str, Any], max_extent_km: float = ORS_AVOID_MAX_EXTENT_KM) -> list[dict[str, Any]]:
    """Trocea el bbox de una geometría en polígonos contiguos <= límite ORS.

    No deforma la cobertura a un cuadrado centrado: conserva el área rectangular
    que envolvía la geometría original. Es una aproximación conservadora para
    respetar ORS; si no cabe en el límite de área, el llamador descartará con aviso.
    """
    points = list(_iter_positions(geometry.get("coordinates")))
    if not points:
        return []
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    min_lon, max_lon, min_lat, max_lat = min(lons), max(lons), min(lats), min(lats)
    max_lat = max(lats)
    mid_lat = (min_lat + max_lat) / 2
    max_lon_step = max_extent_km / (111.32 * max(cos(radians(mid_lat)), 0.01))
    max_lat_step = max_extent_km / 110.57
    pieces: list[dict[str, Any]] = []
    lon = min_lon
    while lon < max_lon:
        next_lon = min(lon + max_lon_step, max_lon)
        lat = min_lat
        while lat < max_lat:
            next_lat = min(lat + max_lat_step, max_lat)
            ring = [[lon, lat], [next_lon, lat], [next_lon, next_lat], [lon, next_lat], [lon, lat]]
            pieces.append({"type": "Polygon", "coordinates": [ring]})
            lat = next_lat
        lon = next_lon
    return pieces


def _polygons_from_geojson(geometry: dict[str, Any]) -> list[list[Any]]:
    if geometry.get("type") == "Polygon":
        return [geometry.get("coordinates")]
    if geometry.get("type") == "MultiPolygon":
        return geometry.get("coordinates") or []
    return []


def _bbox_intersects(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def _geometry_bbox(geometry: dict[str, Any]) -> tuple[float, float, float, float] | None:
    points = list(_iter_positions(geometry.get("coordinates")))
    if not points:
        return None
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    return min(lons), min(lats), max(lons), max(lats)


def _expand_bbox_km(bbox: tuple[float, float, float, float], margin_km: float) -> tuple[float, float, float, float]:
    min_lon, min_lat, max_lon, max_lat = bbox
    mid_lat = (min_lat + max_lat) / 2
    delta_lat = margin_km / 110.57
    delta_lon = margin_km / (111.32 * max(cos(radians(mid_lat)), 0.01))
    return min_lon - delta_lon, min_lat - delta_lat, max_lon + delta_lon, max_lat + delta_lat


def bbox_from_linestring(coords: list[list[float]], margin_km: float = 0.0) -> tuple[float, float, float, float] | None:
    if not coords:
        return None
    lons = [float(p[0]) for p in coords]
    lats = [float(p[1]) for p in coords]
    bbox = (min(lons), min(lats), max(lons), max(lats))
    return _expand_bbox_km(bbox, margin_km) if margin_km else bbox


def filter_records_by_corridor(records: list[dict[str, Any]], coords: list[list[float]], margin_km: float = 50.0) -> list[dict[str, Any]]:
    corridor_bbox = bbox_from_linestring(coords, margin_km=margin_km)
    if not corridor_bbox:
        return []
    filtered: list[dict[str, Any]] = []
    for record in records:
        raw = record.get("buffer_geojson") or record.get("geometry_geojson")
        if not raw:
            continue
        try:
            geometry = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            continue
        if not isinstance(geometry, dict):
            continue
        geometry_bbox = _geometry_bbox(geometry)
        if geometry_bbox and _bbox_intersects(corridor_bbox, geometry_bbox):
            filtered.append(record)
    return filtered


def build_avoid_polygons(records: list[dict[str, Any]], *, max_area_km2: float = ORS_AVOID_MAX_AREA_KM2) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[str]]:
    polygons: list[list[Any]] = []
    used: list[dict[str, Any]] = []
    warnings: list[str] = []
    total_area = 0.0
    for record in records:
        raw = record.get("buffer_geojson") or record.get("geometry_geojson")
        if not raw:
            warnings.append(f"Geometría {record.get('id')} sin buffer_geojson utilizable")
            continue
        try:
            geometry = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            warnings.append(f"Geometría {record.get('id')} no es GeoJSON válido")
            continue
        if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            warnings.append(f"Geometría {record.get('id')} descartada: ORS avoid_polygons requiere Polygon/MultiPolygon")
            continue
        width, height, area = _bbox_km(geometry)
        geometries = [geometry]
        if width > ORS_AVOID_MAX_EXTENT_KM or height > ORS_AVOID_MAX_EXTENT_KM:
            geometries = _split_polygon_to_extent(geometry)
            if not geometries:
                warnings.append(f"Restricción {record.get('restriction_id') or record.get('id')} queda SIN cubrir: no se pudo trocear geometría >20 km")
                continue
            area = sum(_bbox_km(piece)[2] for piece in geometries)
            warnings.append(f"Geometría {record.get('id')} troceada en {len(geometries)} polígonos por límite ORS de 20 km de extensión")
        if total_area + area > max_area_km2:
            warnings.append(f"Restricción {record.get('restriction_id') or record.get('id')} queda SIN cubrir: excede límite ORS de 200 km² de avoid_polygons")
            continue
        extracted: list[list[Any]] = []
        for candidate_geometry in geometries:
            extracted.extend(_polygons_from_geojson(candidate_geometry))
        if not extracted:
            continue
        polygons.extend(extracted)
        total_area += area
        used.append({"id": record.get("id"), "restriction_id": record.get("restriction_id"), "road_normalized": record.get("road_normalized")})
    if not polygons:
        return None, used, warnings
    return {"type": "MultiPolygon", "coordinates": polygons}, used, warnings
