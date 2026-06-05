import json
import sqlite3
from pathlib import Path
from .osm_enrichment import refs_from_geometry
from .query import affected_days, expand_days
from .routing import NominatimOsrmProvider, RoutingProvider, normalize_road_code

DB = Path(__file__).resolve().parents[1] / "data/restricciones.sqlite"

GENERIC_PREFIXES = ("G-", "GEN", "GENERAL")

def restriction_confidence(route_confidence: str, row_confidence: str, match_type: str) -> str:
    if route_confidence == "baja" or match_type == "generic_scope":
        return "baja"
    if (row_confidence or "").lower() == "alta" and route_confidence == "alta":
        return "alta"
    return "media"

def row_to_restriction(row, hits, confidence, match_type):
    tw = json.loads(row["time_windows"] or "[]")
    return {
        "id": row["id"],
        "via": row["road_normalized"],
        "pk": {"start": row["pk_start"], "end": row["pk_end"], "min": row["pk_min"], "max": row["pk_max"]},
        "tramo": {"inicio": row["town_start"], "fin": row["town_end"]},
        "sentido": row["direction_raw"] or row["direction"],
        "franja_horaria": tw,
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

    # Confianza alta solo si tenemos un conjunto razonable de vías. Si no, nunca declarar vía libre.
    route_confidence = route.confidence if len(roads) >= 3 else "baja"
    restrictions = find_route_restrictions(fecha_salida, fecha_llegada, roads, route_confidence)
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
        "enrichment": enrichment,
        "restricciones": restrictions,
        "summary": {
            "total_vias": len(roads),
            "total_restricciones": len(restrictions),
            "no_declarar_via_libre": route_confidence == "baja",
        },
    }
