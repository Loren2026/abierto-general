import json
import urllib.parse
import urllib.request
from dataclasses import dataclass

SPAIN_VIEWBOX = "-9.5,44.2,4.5,35.8"  # west,north,east,south
PROVINCE_HINTS = {
    "asturias": ("asturias", "principado de asturias"),
    "madrid": ("madrid", "comunidad de madrid"),
}


@dataclass
class GeocodedPoint:
    label: str
    lon: float
    lat: float
    raw: dict


def _get_json(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "restricciones-trafico-geocoder/0.1"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def _score_result(query: str, item: dict) -> tuple[int, float]:
    q = (query or "").lower()
    display = (item.get("display_name") or "").lower()
    score = 0
    for hint, needles in PROVINCE_HINTS.items():
        if hint in q and any(needle in display for needle in needles):
            score += 100
    if "españa" in display or "spain" in display:
        score += 20
    if item.get("class") == "place":
        score += 5
    try:
        importance = float(item.get("importance") or 0)
    except (TypeError, ValueError):
        importance = 0
    return score, importance


def geocode_es(query: str, fetch_json=_get_json) -> GeocodedPoint:
    params = urllib.parse.urlencode({
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 5,
        "countrycodes": "es",
        "viewbox": SPAIN_VIEWBOX,
        "bounded": 0,
    })
    data = fetch_json(f"https://nominatim.openstreetmap.org/search?{params}")
    if not data:
        raise ValueError(f"No se pudo geocodificar en España: {query}")
    ranked = sorted(data, key=lambda item: _score_result(query, item), reverse=True)
    best = ranked[0]
    best_score = _score_result(query, best)
    if len(ranked) > 1 and best_score[0] == _score_result(query, ranked[1])[0] and best_score[0] < 100:
        raise ValueError(f"Geocodificación ambigua para '{query}'. Añade provincia o localidad, por ejemplo 'Aranjuez, Madrid'.")
    return GeocodedPoint(
        label=best.get("display_name") or query,
        lon=float(best["lon"]),
        lat=float(best["lat"]),
        raw=best,
    )
