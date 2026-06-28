import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Protocol

ROAD_CODE_RE = re.compile(r"\b(?:AP|A|N|M|CM|CV|EX|AG|VG|BI|GI|SS|NA|CL|ZA|BU|LE|O|AS|E)-?\d+[A-Z]?\b", re.IGNORECASE)

@dataclass
class RouteResult:
    provider: str
    origin: dict
    destination: dict
    geometry: dict
    roads: list[str]
    confidence: str
    warnings: list[str]
    raw_route: dict | None = None

class RoutingProvider(Protocol):
    def route(self, origin: str, destination: str) -> RouteResult: ...

def normalize_road_code(value: str) -> str:
    raw = (value or "").upper().replace(" ", "")
    match = ROAD_CODE_RE.search(raw)
    if not match:
        return ""
    token = match.group(0).upper().replace(" ", "")
    token = re.sub(r"^([A-Z]+)(\d)", r"\1-\2", token)
    return token

def extract_road_codes(text: str) -> list[str]:
    found = []
    for match in ROAD_CODE_RE.finditer(text or ""):
        code = normalize_road_code(match.group(0))
        if code and code not in found:
            found.append(code)
    return found

class NominatimOsrmProvider:
    """Proveedor gratuito/intercambiable: Nominatim para geocoding + OSRM público para ruta."""

    def __init__(self, nominatim_base="https://nominatim.openstreetmap.org", osrm_base="https://router.project-osrm.org"):
        self.nominatim_base = nominatim_base.rstrip("/")
        self.osrm_base = osrm_base.rstrip("/")

    def _get_json(self, url: str):
        req = urllib.request.Request(url, headers={"User-Agent": "restricciones-trafico-local/0.1"})
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))

    def geocode(self, query: str) -> dict:
        params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1, "countrycodes": "es"})
        data = self._get_json(f"{self.nominatim_base}/search?{params}")
        if not data:
            raise ValueError(f"No se pudo geocodificar: {query}")
        item = data[0]
        return {"label": item.get("display_name"), "lat": float(item["lat"]), "lon": float(item["lon"])}

    def route(self, origin: str, destination: str) -> RouteResult:
        o = self.geocode(origin)
        d = self.geocode(destination)
        coords = f"{o['lon']},{o['lat']};{d['lon']},{d['lat']}"
        params = urllib.parse.urlencode({"overview": "full", "geometries": "geojson", "steps": "true"})
        data = self._get_json(f"{self.osrm_base}/route/v1/driving/{coords}?{params}")
        routes = data.get("routes") or []
        if not routes:
            raise ValueError("OSRM no devolvió ruta")
        route = routes[0]
        roads = []
        for leg in route.get("legs") or []:
            for step in leg.get("steps") or []:
                for code in extract_road_codes(step.get("name") or ""):
                    if code not in roads:
                        roads.append(code)
        warnings = []
        confidence = "alta" if roads else "baja"
        if not roads:
            warnings.append("OSRM devolvió geometría pero no nombres/códigos de vía suficientes; no declarar vía libre.")
        return RouteResult("osrm-public", o, d, route.get("geometry") or {}, roads, confidence, warnings, route)
