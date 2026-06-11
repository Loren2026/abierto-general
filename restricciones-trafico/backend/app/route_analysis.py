import json
import sqlite3
from pathlib import Path
from math import atan2, cos, radians, sin, sqrt
from .alternative_routing import FIXED_SPEED_KMH, calculate_eta
from .osm_enrichment import refs_from_geometry
from .query import affected_days, expand_days
from .routing import NominatimOsrmProvider, RoutingProvider, normalize_road_code

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

def find_route_restrictions(fecha_salida: str, fecha_llegada: str, roads: list[str], route_confidence: str):
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
        hits = affected_days(row["restriction_type"], rule, days)
        if not hits:
            continue
        road = (row["road_normalized"] or "").upper()
        match_type = "road_code" if road in roads_norm else "generic_scope"
        out.append(row_to_restriction(row, hits, restriction_confidence(route_confidence, row["confidence"], match_type), match_type))
    out.sort(key=lambda item: (item["confidence"], item["via"] or "", item["id"]))
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
    restrictions = find_route_restrictions(fecha_salida, fecha_llegada, roads, route_confidence)
    distance_km = round(geometry_distance_km(route.geometry), 3)
    # El flujo clásico no tiene hora propia; si el frontend la envía añadida al payload, main la pasa.
    hora_salida = getattr(provider, "hora_salida", None) or "08:00"
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
        "summary": {
            "total_vias": len(roads),
            "total_restricciones": len(restrictions),
            "no_declarar_via_libre": route_confidence == "baja",
        },
    }
