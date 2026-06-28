import json
import sqlite3
from pathlib import Path
from math import atan2, cos, radians, sin, sqrt
from .alternative_routing import FIXED_SPEED_KMH, calculate_eta
from .osm_enrichment import refs_from_geometry
from .query import affected_days, expand_days, time_window_matches
from .routing import NominatimOsrmProvider, RoutingProvider, extract_road_codes, normalize_road_code
from .supabase_geometries import fetch_restriction_geometries_by_ids, supabase_configured

DB = Path(__file__).resolve().parents[1] / "data/restricciones.sqlite"

GENERIC_PREFIXES = ("G-", "GEN", "GENERAL")
MAIN_ROAD_PREFIXES = ("AP-", "A-", "N-")

def is_main_road(road: str) -> bool:
    return (road or "").upper().startswith(MAIN_ROAD_PREFIXES)

def calculate_route_confidence(route_confidence: str, roads: list[str], enrichment: dict) -> str:
    """Calcula confianza real de detección de vías, no solo la confianza inicial de OSRM.

    OSRM público puede devolver geometría buena pero pocos nombres de vía. Si Overpass
    enriquece con refs principales suficientes, la confianza debe subir.
    """
    normalized = [normalize_road_code(road) for road in roads if normalize_road_code(road)]
    main_roads = [road for road in normalized if is_main_road(road)]
    overpass_roads = enrichment.get("roads") or []
    overpass_warnings = enrichment.get("warnings") or []
    overpass_failed = bool(enrichment.get("provider") == "overpass" and overpass_warnings and not overpass_roads)

    if overpass_failed or len(normalized) < 2:
        return "baja"
    if len(main_roads) >= 3 and (overpass_roads or route_confidence == "alta"):
        return "alta"
    if main_roads:
        return "media"
    return "baja"

def restriction_confidence(route_confidence: str, row_confidence: str, match_type: str) -> str:
    if route_confidence == "baja" or match_type == "generic_scope":
        return "baja"
    if (row_confidence or "").lower() == "alta" and route_confidence == "alta":
        return "alta"
    return "media"

def row_to_restriction(row, hits, confidence, match_type):
    tw = json.loads(row["time_windows"] or "[]")
    date_rule = json.loads(row["date_rule"] or "{}")
    return {
        "id": row["id"],
        "via": row["road_normalized"],
        "pk": {"start": row["pk_start"], "end": row["pk_end"], "min": row["pk_min"], "max": row["pk_max"]},
        "tramo": {"inicio": row["town_start"], "fin": row["town_end"]},
        "sentido": row["direction_raw"] or row["direction"],
        "franja_horaria": tw,
        "date_rule": date_rule,
        "regla_fechas": date_rule.get("raw") or row["restriction_type"] or "No detallada",
        "dias_afecta": hits,
        "confidence": confidence,
        "restriction_confidence": row["confidence"],
        "match_type": match_type,
        "restriction_type": row["restriction_type"],
        "source_scope": row["source_scope"],
        "aplica_a_loren": bool(row["aplica_a_loren"]),
    }

def find_route_restrictions(fecha_salida: str, fecha_llegada: str, roads: list[str], route_confidence: str, hora_salida: str | None = None):
    days = expand_days(fecha_salida, fecha_llegada)
    roads_norm = sorted({normalize_road_code(road) for road in roads if normalize_road_code(road)})
    if not roads_norm:
        return []
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    placeholders = ",".join("?" for _ in roads_norm)
    rows = conn.execute(
        f"SELECT * FROM restrictions WHERE UPPER(road_normalized) IN ({placeholders}) OR road_normalized LIKE 'G-%'",
        roads_norm,
    ).fetchall()
    conn.close()
    out = []
    for row in rows:
        if row["aplica_solo_transfronterizo"] == 1:
            continue
        rule = json.loads(row["date_rule"] or "{}")
        time_windows = json.loads(row["time_windows"] or "[]")
        hits = affected_days(row["restriction_type"], rule, days)
        if not hits or not time_window_matches(time_windows, hora_salida):
            continue
        road = (row["road_normalized"] or "").upper()
        match_type = "road_code" if road in roads_norm else "generic_scope"
        out.append(row_to_restriction(row, hits, restriction_confidence(route_confidence, row["confidence"], match_type), match_type))
    out.sort(key=lambda item: (item["confidence"], item["via"] or "", item["id"]))
    return out


def attach_restriction_geometries(restrictions: list[dict]) -> list[dict]:
    out = [dict(item) for item in restrictions]
    if not out or not supabase_configured():
        for item in out:
            item["restriction_geometry"] = None
            item["has_geometry"] = False
            item["geometry_status"] = "missing"
            item["geometry_warning"] = "Tramo sin geometría precisa: no se debe pintar un trazo estimado como si fuera real."
        return out
    try:
        geometries = fetch_restriction_geometries_by_ids([str(item.get("id")) for item in out])
    except Exception:  # noqa: BLE001 - no romper el aviso SQLite por fallo externo de Supabase
        for item in out:
            item["restriction_geometry"] = None
            item["has_geometry"] = False
            item["geometry_status"] = "missing"
            item["geometry_warning"] = "Tramo sin geometría precisa: no se debe pintar un trazo estimado como si fuera real."
        return out
    for item in out:
        geometry = (geometries.get(str(item.get("id"))) or {}).get("geometry")
        coords = (geometry or {}).get("coordinates") or []
        if isinstance(geometry, dict) and len(coords) > 1:
            item["restriction_geometry"] = geometry
            item["has_geometry"] = True
            item["geometry_status"] = "available"
        else:
            item["restriction_geometry"] = None
            item["has_geometry"] = False
            item["geometry_status"] = "missing"
            item["geometry_warning"] = "Tramo sin geometría precisa: no se debe pintar un trazo estimado como si fuera real."
    return out


def geometry_distance_km(geometry: dict | None) -> float:
    coords = (geometry or {}).get("coordinates") or []
    if len(coords) < 2:
        return 0.0
    radius_km = 6371.0088
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
        phi1, phi2 = radians(lat1), radians(lat2)
        dphi = radians(lat2 - lat1)
        dlambda = radians(lon2 - lon1)
        a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
        total += 2 * radius_km * atan2(sqrt(a), sqrt(1 - a))
    return total


def _point_segment_distance_km(point, a, b) -> float:
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
    return sqrt((x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2)


def _linestring_distance_to_points_km(coords: list[list[float]], points: list[list[float]]) -> float:
    if len(coords) < 2 or not points:
        return float("inf")
    return min(_point_segment_distance_km(point, a, b) for point in points for a, b in zip(coords, coords[1:]))


def _restriction_points(restriction: dict) -> list[list[float]]:
    coords = (restriction.get("restriction_geometry") or {}).get("coordinates") or []
    return [point for point in coords if isinstance(point, list) and len(point) >= 2]


def validate_restriction_geometries_on_route(restrictions: list[dict], route_geometry: dict | None, max_distance_km: float = 5.0) -> list[dict]:
    route_coords = (route_geometry or {}).get("coordinates") or []
    if len(route_coords) < 2:
        return restrictions
    out = []
    for restriction in restrictions:
        item = dict(restriction)
        points = _restriction_points(item)
        if item.get("has_geometry") and points:
            distance = _linestring_distance_to_points_km(route_coords, points)
            if distance > max_distance_km:
                item["restriction_geometry"] = None
                item["has_geometry"] = False
                item["geometry_status"] = "missing"
                item["geometry_warning"] = "Tramo sin geometría precisa: la geometría disponible no cae sobre la ruta consultada, así que no se pinta un trazo estimado."
        out.append(item)
    return out


def build_original_road_segments(route, restrictions: list[dict], geometry_match_threshold_km: float = 0.5) -> list[dict]:
    route_raw = getattr(route, "raw_route", None) or {}
    restrictions_by_road: dict[str, list[dict]] = {}
    for restriction in restrictions:
        road = normalize_road_code(restriction.get("via") or "")
        if road:
            restrictions_by_road.setdefault(road, []).append(restriction)

    segments: list[dict] = []
    for leg in route_raw.get("legs") or []:
        for step in leg.get("steps") or []:
            road = step.get("name") or step.get("ref") or step.get("destinations") or ""
            road_codes = extract_road_codes(" ".join(str(step.get(key) or "") for key in ("ref", "name", "destinations")))
            road_code = road_codes[0] if road_codes else ""
            geometry = step.get("geometry") or {}
            coords = geometry.get("coordinates") or []
            if not road_code or len(coords) < 2:
                continue
            distance_km = round(float(step.get("distance") or 0) / 1000, 3)
            if distance_km < 1:
                continue
            candidates = list(restrictions_by_road.get(road_code, []))
            geometry_matches = []
            for item in candidates:
                if not item.get("has_geometry"):
                    continue
                distance_to_restriction = _linestring_distance_to_points_km(coords, _restriction_points(item))
                if distance_to_restriction <= geometry_match_threshold_km:
                    geometry_matches.append((distance_to_restriction, item))
            segment_restrictions = [item for _, item in sorted(geometry_matches, key=lambda match: match[0])]
            segments.append({
                "road": road,
                "road_code": road_code,
                "type": "autopista" if road_code.startswith("AP-") else "autovia" if road_code.startswith("A-") else "nacional" if road_code.startswith("N-") else "resto",
                "distance_km": distance_km,
                "geometry": {"type": "LineString", "coordinates": coords},
                "restricted": bool(segment_restrictions),
                "restrictions": segment_restrictions,
            })
    return segments

def analyze_route(
    origen: str,
    destino: str,
    fecha_salida: str,
    fecha_llegada: str,
    provider: RoutingProvider | None = None,
    enrich_with_overpass: bool = True,
):
    provider = provider or NominatimOsrmProvider()
    route = provider.route(origen, destino)
    roads = list(route.roads)
    warnings = list(route.warnings)
    enrichment = {"provider": None, "roads": [], "warnings": []}

    # OSRM público a veces devuelve geometría correcta pero pocos refs de carretera.
    # En ese caso enriquecemos con Overpass sobre la geometría OSM para obtener tags ref reales.
    if enrich_with_overpass and route.geometry:
        try:
            osm_roads, osm_warnings = refs_from_geometry(route.geometry)
            enrichment = {"provider": "overpass", "roads": osm_roads, "warnings": osm_warnings}
            for road in osm_roads:
                if road not in roads:
                    roads.append(road)
            warnings.extend(osm_warnings)
        except Exception as error:
            warnings.append(f"Overpass no disponible o falló: {error}")
            enrichment = {"provider": "overpass", "roads": [], "warnings": [str(error)]}

    # Confianza basada en la detección final: OSRM + enriquecimiento Overpass.
    # Un aviso inicial de OSRM por pocos nombres no fuerza baja si Overpass recuperó refs principales.
    route_confidence = calculate_route_confidence(route.confidence, roads, enrichment)
    # El flujo clásico no tiene hora propia; si el frontend la envía añadida al payload, main la pasa.
    hora_salida = getattr(provider, "hora_salida", None) or "08:00"
    restrictions = validate_restriction_geometries_on_route(
        attach_restriction_geometries(find_route_restrictions(fecha_salida, fecha_llegada, roads, route_confidence, hora_salida)),
        route.geometry,
    )
    distance_km = round(geometry_distance_km(route.geometry), 3)
    eta = calculate_eta(distance_km, fecha_salida, hora_salida)
    return {
        "provider": route.provider,
        "origen": route.origin,
        "destino": route.destination,
        "fecha_salida": fecha_salida,
        "fecha_llegada": fecha_llegada,
        "vias_detectadas": roads,
        "route_confidence": route_confidence,
        "warnings": warnings,
        "geometry": route.geometry,
        "distance_km": distance_km,
        "fixed_speed_kmh": FIXED_SPEED_KMH,
        "eta_minutes": eta["eta_minutes"],
        "eta_at": eta["eta_at"],
        "enrichment": enrichment,
        "restricciones": restrictions,
        "road_segments": {"original": build_original_road_segments(route, restrictions), "alternative": []},
        "summary": {
            "total_vias": len(roads),
            "total_restricciones": len(restrictions),
            "no_declarar_via_libre": route_confidence == "baja",
        },
    }
