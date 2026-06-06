import json
import math
import urllib.parse
import urllib.request
from .routing import normalize_road_code

OVERPASS_DEFAULT_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_FALLBACK_URLS = [
    OVERPASS_DEFAULT_URL,
    "https://overpass.kumi.systems/api/interpreter",
]


def _sample_coordinates(coords, max_points=24):
    if not coords:
        return []
    if len(coords) <= max_points:
        return coords
    step = max(1, math.floor(len(coords) / max_points))
    sampled = coords[::step]
    if coords[-1] not in sampled:
        sampled.append(coords[-1])
    return sampled[:max_points]


def _around_clauses(coords, radius_m):
    # GeoJSON coords: [lon, lat]. Overpass: lat,lon.
    return "\n".join(f'way(around:{radius_m},{lat:.6f},{lon:.6f})["highway"]["ref"];' for lon, lat in coords)


def refs_from_geometry(geometry: dict, overpass_url: str = OVERPASS_DEFAULT_URL, radius_m: int = 80) -> tuple[list[str], list[str]]:
    """Extrae refs de carreteras OSM cercanas a puntos muestreados de una geometría GeoJSON."""
    coords = geometry.get("coordinates") or []
    sampled = _sample_coordinates(coords, max_points=16)
    warnings = []
    if not sampled:
        return [], ["No hay geometría para enriquecer con Overpass."]

    query = f"""
[out:json][timeout:25];
(
{_around_clauses(sampled, radius_m)}
);
out tags;
"""
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    urls = [overpass_url] if overpass_url != OVERPASS_DEFAULT_URL else OVERPASS_FALLBACK_URLS
    last_error = None
    payload = None
    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"User-Agent": "restricciones-trafico-local/0.1"},
            )
            with urllib.request.urlopen(req, timeout=40) as response:
                payload = json.loads(response.read().decode("utf-8"))
                break
        except Exception as error:
            last_error = error
            warnings.append(f"Overpass falló en {url}: {error}")
    if payload is None:
        raise last_error or RuntimeError("Overpass no devolvió respuesta")

    refs = []
    for element in payload.get("elements") or []:
        ref_value = (element.get("tags") or {}).get("ref") or ""
        for part in ref_value.replace(";", ",").split(","):
            code = normalize_road_code(part.strip())
            if code and code not in refs:
                refs.append(code)

    if not refs:
        warnings.append("Overpass respondió pero no devolvió refs de carretera cercanas a la geometría.")
    return refs, warnings
