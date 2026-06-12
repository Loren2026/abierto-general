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


def fetch_high_confidence_geometries(limit: int = 9) -> list[dict[str, Any]]:
    cached = _cache.get("records")
    if cached is not None and time.time() < float(_cache.get("expires_at") or 0):
        return cached
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas")
    query = urllib.parse.urlencode({
        "select": "id,restriction_id,road_normalized,buffer_geojson,geometry_geojson,confidence",
        "confidence": "eq.alta",
        "limit": str(limit),
    })
    req = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/restriction_geometries?{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        records = json.loads(response.read().decode("utf-8"))
    _cache["records"] = records
    _cache["expires_at"] = time.time() + CACHE_TTL_SECONDS
    return records


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


def _shrink_polygon_to_extent(geometry: dict[str, Any], max_extent_km: float = ORS_AVOID_MAX_EXTENT_KM) -> dict[str, Any]:
    points = list(_iter_positions(geometry.get("coordinates")))
    if not points:
        return geometry
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    center_lon = (min(lons) + max(lons)) / 2
    center_lat = (min(lats) + max(lats)) / 2
    half_lat = (max_extent_km / 2) / 110.57
    half_lon = (max_extent_km / 2) / (111.32 * max(cos(radians(center_lat)), 0.01))
    ring = [
        [center_lon - half_lon, center_lat - half_lat],
        [center_lon + half_lon, center_lat - half_lat],
        [center_lon + half_lon, center_lat + half_lat],
        [center_lon - half_lon, center_lat + half_lat],
        [center_lon - half_lon, center_lat - half_lat],
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def _polygons_from_geojson(geometry: dict[str, Any]) -> list[list[Any]]:
    if geometry.get("type") == "Polygon":
        return [geometry.get("coordinates")]
    if geometry.get("type") == "MultiPolygon":
        return geometry.get("coordinates") or []
    return []


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
        if width > ORS_AVOID_MAX_EXTENT_KM or height > ORS_AVOID_MAX_EXTENT_KM:
            geometry = _shrink_polygon_to_extent(geometry)
            width, height, area = _bbox_km(geometry)
            warnings.append(f"Geometría {record.get('id')} simplificada por límite ORS de 20 km de extensión")
        if total_area + area > max_area_km2:
            warnings.append("Límite ORS de 200 km² alcanzado; se omiten geometrías restantes")
            break
        extracted = _polygons_from_geojson(geometry)
        if not extracted:
            continue
        polygons.extend(extracted)
        total_area += area
        used.append({"id": record.get("id"), "restriction_id": record.get("restriction_id"), "road_normalized": record.get("road_normalized")})
    if not polygons:
        return None, used, warnings
    return {"type": "MultiPolygon", "coordinates": polygons}, used, warnings
