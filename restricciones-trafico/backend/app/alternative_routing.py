from datetime import datetime, timedelta
from enum import Enum
from math import ceil
import re
from typing import Any, Literal, Protocol
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator

from .adr_calendar import adr_calendar_warnings
from .crossed_restrictions import crossed_restrictions_for_route
from .geocoding import geocode_es
from .supabase_geometries import build_avoid_polygons, fetch_high_confidence_geometries, supabase_configured

FIXED_SPEED_KMH = 78
DEFAULT_TIMEZONE = "Europe/Madrid"


class CargoType(str, Enum):
    general = "general"
    adr = "adr"


class RoutingVehicle(BaseModel):
    mass_kg: int = Field(default=7500, ge=1)
    length_m: float = Field(default=17, gt=0)
    height_m: float = Field(default=4, gt=0)


class RutaAlternativaRequest(BaseModel):
    origen: str = Field(min_length=1)
    destino: str = Field(min_length=1)
    fecha_salida: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora_salida: str = Field(pattern=r"^\d{2}:\d{2}$")
    fecha_llegada: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    cargo_type: CargoType = CargoType.general
    vehicle: RoutingVehicle = Field(default_factory=RoutingVehicle)

    @field_validator("hora_salida")
    @classmethod
    def validate_hora_salida(cls, value: str) -> str:
        hour, minute = [int(part) for part in value.split(":")]
        if hour > 23 or minute > 59:
            raise ValueError("hora_salida debe estar en formato HH:MM válido")
        return value


class RouteMetrics(BaseModel):
    geometry: dict[str, Any] | None = None
    distance_km: float
    eta_minutes: int
    eta_at: str
    road_category_score: float


class AlternativeRoute(RouteMetrics):
    selected: bool = False
    reason: str | None = None


class RimpStatus(BaseModel):
    mode: Literal["informativo"] = "informativo"
    status: Literal["en_preparacion"] = "en_preparacion"
    message: str = "RIMP 2026 pendiente de carga validada por PATRÓN ORO"


class RutaAlternativaResponse(BaseModel):
    provider: str
    alternative_status: dict[str, Any] | None = None
    origen: dict[str, Any] | None = None
    destino: dict[str, Any] | None = None
    fixed_speed_kmh: int = FIXED_SPEED_KMH
    original_route: RouteMetrics
    alternative_route: AlternativeRoute | None = None
    crossed_restrictions: list[dict[str, Any]] = Field(default_factory=list)
    crossed_status: dict[str, Any] = Field(default_factory=lambda: {"checked": False, "reason": "No calculado"})
    avoid_polygons_used: list[dict[str, Any]] = Field(default_factory=list)
    rimp: RimpStatus = Field(default_factory=RimpStatus)
    warnings: list[str] = Field(default_factory=list)


class OrsClientProtocol(Protocol):
    def directions_hgv(self, coordinates: list[list[float]], vehicle: RoutingVehicle, avoid_polygons: dict[str, Any] | None = None) -> dict[str, Any]: ...


ROAD_CATEGORY_WEIGHTS = {
    "motorway": 100,
    "autopista": 100,
    "autovia": 90,
    "trunk": 90,
    "nacional": 70,
    "resto": 10,
}
LOCAL_ROAD_PENALTY = 1000
RESTRICTION_PENALTY = 10000


def calculate_eta(distance_km: float, fecha_salida: str, hora_salida: str, speed_kmh: int = FIXED_SPEED_KMH, tz: str = DEFAULT_TIMEZONE) -> dict[str, Any]:
    if distance_km < 0:
        raise ValueError("distance_km no puede ser negativa")
    if speed_kmh <= 0:
        raise ValueError("speed_kmh debe ser mayor que cero")
    departure = datetime.fromisoformat(f"{fecha_salida}T{hora_salida}:00").replace(tzinfo=ZoneInfo(tz))
    minutes = int(round((distance_km / speed_kmh) * 60))
    eta = departure + timedelta(minutes=minutes)
    return {"eta_minutes": minutes, "eta_at": eta.isoformat(), "fixed_speed_kmh": speed_kmh}


def score_road_categories(
    *,
    km_autopista: float = 0,
    km_autovia: float = 0,
    km_nacional: float = 0,
    km_resto: float = 0,
    km_comarcal_local: float = 0,
    restricciones_cruzadas: int = 0,
) -> float:
    return (
        km_autopista * ROAD_CATEGORY_WEIGHTS["autopista"]
        + km_autovia * ROAD_CATEGORY_WEIGHTS["autovia"]
        + km_nacional * ROAD_CATEGORY_WEIGHTS["nacional"]
        + km_resto * ROAD_CATEGORY_WEIGHTS["resto"]
        - km_comarcal_local * LOCAL_ROAD_PENALTY
        - restricciones_cruzadas * RESTRICTION_PENALTY
    )


def route_has_disallowed_local_roads(route_categories: dict[str, float]) -> bool:
    return route_categories.get("comarcal_local", 0) > 0


def road_category_from_name(name: str) -> str:
    value = (name or "").upper().replace(" ", "")
    if re.search(r"\bAP-?\d+", value):
        return "autopista"
    if re.search(r"\bA-?\d+", value):
        return "autovia"
    if re.search(r"\bM-?(?:30|40|45|50)\b", value):
        return "autovia"
    if re.search(r"\bN-?\d+", value):
        return "nacional"
    if re.search(r"\b(?:AS|CV|CM|CL|EX|GI|BI|NA|BU|LE|ZA|O|P|VA|VP|M)-?\d+", value):
        return "comarcal_local"
    return "resto"


def categories_from_ors_feature(feature: dict[str, Any]) -> dict[str, float]:
    categories = {"autopista": 0.0, "autovia": 0.0, "nacional": 0.0, "resto": 0.0, "comarcal_local": 0.0}
    for segment in feature.get("properties", {}).get("segments", []) or []:
        for step in segment.get("steps", []) or []:
            distance_km = float(step.get("distance") or 0) / 1000
            category = road_category_from_name(step.get("name") or "")
            categories[category] += distance_km
    if not any(categories.values()):
        distance_km = float(feature.get("properties", {}).get("summary", {}).get("distance") or 0) / 1000
        categories["resto"] = distance_km
    return categories


def select_best_route(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Selecciona la ruta con mejor categoría y, dentro de ese criterio, menor ETA/distancia.

    Las candidatas con comarcales/locales se descartan si existe alguna alternativa sin ellas.
    """
    if not candidates:
        return None
    viable = [candidate for candidate in candidates if not route_has_disallowed_local_roads(candidate.get("categories", {}))]
    pool = viable or candidates

    def best_category_tier(categories: dict[str, float]) -> int:
        if categories.get("autopista", 0) > 0:
            return 4
        if categories.get("autovia", 0) > 0:
            return 3
        if categories.get("nacional", 0) > 0:
            return 2
        if categories.get("resto", 0) > 0:
            return 1
        return 0

    def sort_key(candidate: dict[str, Any]):
        categories = candidate.get("categories", {})
        score = score_road_categories(
            km_autopista=categories.get("autopista", 0),
            km_autovia=categories.get("autovia", 0),
            km_nacional=categories.get("nacional", 0),
            km_resto=categories.get("resto", 0),
            km_comarcal_local=categories.get("comarcal_local", 0),
            restricciones_cruzadas=candidate.get("restricciones_cruzadas", 0),
        )
        eta_minutes = ceil((candidate.get("distance_km", 0) / FIXED_SPEED_KMH) * 60)
        return (-best_category_tier(categories), eta_minutes, candidate.get("distance_km", 0), -score)

    return sorted(pool, key=sort_key)[0]


def route_metrics_from_ors_feature(feature: dict[str, Any], req: RutaAlternativaRequest) -> dict[str, Any]:
    distance_km = float(feature.get("properties", {}).get("summary", {}).get("distance") or 0) / 1000
    categories = categories_from_ors_feature(feature)
    score = score_road_categories(
        km_autopista=categories.get("autopista", 0),
        km_autovia=categories.get("autovia", 0),
        km_nacional=categories.get("nacional", 0),
        km_resto=categories.get("resto", 0),
        km_comarcal_local=categories.get("comarcal_local", 0),
    )
    eta = calculate_eta(distance_km, req.fecha_salida, req.hora_salida)
    roads = []
    for segment in feature.get("properties", {}).get("segments", []) or []:
        for step in segment.get("steps", []) or []:
            name = step.get("name")
            if name and name not in roads:
                roads.append(name)
    return {
        "geometry": feature.get("geometry"),
        "distance_km": round(distance_km, 3),
        "eta_minutes": eta["eta_minutes"],
        "eta_at": eta["eta_at"],
        "road_category_score": score,
        "categories": categories,
        "roads": roads,
    }


def build_ruta_alternativa_response(req: RutaAlternativaRequest, ors_data: dict[str, Any], *, alternative_ors_data: dict[str, Any] | None = None, alternative_error: str | None = None, avoid_polygons_used: list[dict[str, Any]] | None = None, avoid_warnings: list[str] | None = None, crossed_restrictions: list[dict[str, Any]] | None = None, crossed_status: dict[str, Any] | None = None) -> RutaAlternativaResponse:
    features = ors_data.get("features") or []
    if not features:
        raise ValueError("ORS no devolvió rutas candidatas")

    candidates = []
    for idx, feature in enumerate(features):
        metrics = route_metrics_from_ors_feature(feature, req)
        candidates.append({"id": idx, "feature": feature, **metrics})
    selected = select_best_route(candidates) or candidates[0]
    original = candidates[0]

    original_route = RouteMetrics(**{key: original[key] for key in ["geometry", "distance_km", "eta_minutes", "eta_at", "road_category_score"]})
    alternative_route = None
    alternative_reason = None
    if alternative_ors_data:
        alternative_features = alternative_ors_data.get("features") or []
        alternative_candidates = []
        for idx, feature in enumerate(alternative_features):
            metrics = route_metrics_from_ors_feature(feature, req)
            alternative_candidates.append({"id": idx, "feature": feature, **metrics})
        selected_alternative = select_best_route(alternative_candidates)
        if selected_alternative:
            alternative_reason = "Ruta calculada por ORS driving-hgv evitando restriction_geometries de confianza alta; seleccionada por categoría de vía y ETA/distancia a 78 km/h"
            alternative_route = AlternativeRoute(
                selected=True,
                reason=alternative_reason,
                **{key: selected_alternative[key] for key in ["geometry", "distance_km", "eta_minutes", "eta_at", "road_category_score"]},
            )
    elif selected["id"] != original["id"] or len(candidates) > 1:
        alternative_reason = "Seleccionada por categoría de vía y ETA/distancia a 78 km/h sin avoid_polygons aplicados"
        alternative_route = AlternativeRoute(
            selected=True,
            reason=alternative_reason,
            **{key: selected[key] for key in ["geometry", "distance_km", "eta_minutes", "eta_at", "road_category_score"]},
        )

    warnings = list(avoid_warnings or [])
    if req.cargo_type == CargoType.adr:
        warnings.extend(adr_calendar_warnings(req.fecha_salida, req.hora_salida, original.get("eta_minutes")))
    if route_has_disallowed_local_roads(selected.get("categories", {})):
        warnings.append("No se encontró alternativa sin comarcales/locales; revisar manualmente.")

    reason = alternative_error
    if alternative_route is None:
        reason = reason or "No he encontrado rutas alternativas: ORS no devolvió una ruta alternativa válida con los criterios actuales."
        warnings.append(reason)
    response = RutaAlternativaResponse(
        provider="openrouteservice",
        alternative_status={"found": alternative_route is not None, "reason": reason or alternative_reason, "avoid_polygons": bool(avoid_polygons_used)},
        original_route=original_route,
        alternative_route=alternative_route,
        crossed_restrictions=crossed_restrictions or [],
        crossed_status=crossed_status or {"checked": False, "reason": "No calculado"},
        avoid_polygons_used=avoid_polygons_used or [],
        warnings=warnings,
    )
    # Compatibilidad UI con el flujo clásico: evita lista de vías vacía/confianza baja artificial.
    response_dict = response.model_dump()
    response_dict["vias_detectadas"] = original.get("roads", [])
    response_dict["road_categories"] = original.get("categories", {})
    response_dict["route_confidence"] = "alta" if original.get("roads") else "media"
    return response_dict


def calculate_alternative_route(req: RutaAlternativaRequest, ors_client: OrsClientProtocol, coordinates: list[list[float]] | None = None) -> dict[str, Any]:
    if coordinates is None:
        origin = geocode_es(req.origen)
        destination = geocode_es(req.destino)
        route_coordinates = [[origin.lon, origin.lat], [destination.lon, destination.lat]]
    else:
        origin = destination = None
        route_coordinates = coordinates
    ors_data = ors_client.directions_hgv(route_coordinates, req.vehicle)
    avoid_polygons = None
    avoid_used: list[dict[str, Any]] = []
    avoid_warnings: list[str] = []
    alternative_ors_data = None
    alternative_error = None
    if supabase_configured():
        try:
            records = fetch_high_confidence_geometries(limit=9)
            avoid_polygons, avoid_used, avoid_warnings = build_avoid_polygons(records)
            if avoid_polygons:
                try:
                    alternative_ors_data = ors_client.directions_hgv(route_coordinates, req.vehicle, avoid_polygons=avoid_polygons)
                except Exception as exc:  # noqa: BLE001 - devolver motivo honesto al usuario/API
                    alternative_error = f"ORS no encontró o rechazó ruta alternativa con avoid_polygons: {exc}"
            else:
                alternative_error = "No hay polígonos válidos de confianza alta para enviar a ORS avoid_polygons"
        except Exception as exc:  # noqa: BLE001 - configuración/datos externos; no ocultar motivo
            alternative_error = f"No se pudieron leer restriction_geometries de Supabase: {exc}"
    else:
        alternative_error = "Supabase no configurado en este entorno; avoid_polygons no aplicado"
    route_features = (ors_data.get("features") or [])
    route_geometry = route_features[0].get("geometry") if route_features else None
    crossed, crossed_status = crossed_restrictions_for_route(route_geometry, req.fecha_salida, getattr(req, "fecha_llegada", req.fecha_salida))
    response = build_ruta_alternativa_response(req, ors_data, alternative_ors_data=alternative_ors_data, alternative_error=alternative_error, avoid_polygons_used=avoid_used, avoid_warnings=avoid_warnings, crossed_restrictions=crossed, crossed_status=crossed_status)
    if origin and destination:
        response["origen"] = {"label": origin.label, "lon": origin.lon, "lat": origin.lat}
        response["destino"] = {"label": destination.label, "lon": destination.lon, "lat": destination.lat}
    return response
