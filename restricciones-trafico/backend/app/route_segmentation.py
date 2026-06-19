from math import asin, cos, radians, sin, sqrt
from typing import Any

EARTH_RADIUS_KM = 6371.0088
DEDUPLICATE_JOIN_TOLERANCE_KM = 0.01


def distance_km_between_points(a: list[float], b: list[float]) -> float:
    lon1, lat1 = radians(float(a[0])), radians(float(a[1]))
    lon2, lat2 = radians(float(b[0])), radians(float(b[1]))
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


def linestring_distance_km(coords: list[list[float]]) -> float:
    return sum(distance_km_between_points(a, b) for a, b in zip(coords, coords[1:]))


def split_linestring_by_distance(coords: list[list[float]], max_km: float = 140.0) -> list[list[list[float]]]:
    if len(coords) < 2:
        return []
    segments: list[list[list[float]]] = []
    current = [coords[0]]
    current_km = 0.0
    for point in coords[1:]:
        step_km = distance_km_between_points(current[-1], point)
        if len(current) > 1 and current_km + step_km > max_km:
            segments.append(current)
            current = [current[-1], point]
            current_km = step_km
        else:
            current.append(point)
            current_km += step_km
    if len(current) > 1:
        segments.append(current)
    return segments


def merge_ors_segment_responses(responses: list[dict[str, Any]]) -> dict[str, Any]:
    merged_coords: list[list[float]] = []
    merged_segments: list[dict[str, Any]] = []
    total_distance = 0.0
    total_duration = 0.0
    for data in responses:
        features = data.get("features") or []
        if not features:
            continue
        feature = features[0]
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        if merged_coords and coords and distance_km_between_points(merged_coords[-1], coords[0]) < DEDUPLICATE_JOIN_TOLERANCE_KM:
            merged_coords.extend(coords[1:])
        else:
            merged_coords.extend(coords)
        props = feature.get("properties") or {}
        summary = props.get("summary") or {}
        total_distance += float(summary.get("distance") or 0)
        total_duration += float(summary.get("duration") or 0)
        merged_segments.extend(props.get("segments") or [])
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": merged_coords},
            "properties": {"summary": {"distance": total_distance, "duration": total_duration}, "segments": merged_segments},
        }],
    }
