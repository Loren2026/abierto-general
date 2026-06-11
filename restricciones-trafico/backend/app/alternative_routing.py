from datetime import datetime, timedelta
from enum import Enum
from math import ceil
from typing import Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator

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
    fixed_speed_kmh: int = FIXED_SPEED_KMH
    original_route: RouteMetrics
    alternative_route: AlternativeRoute | None = None
    crossed_restrictions: list[dict[str, Any]] = Field(default_factory=list)
    avoid_polygons_used: list[dict[str, Any]] = Field(default_factory=list)
    rimp: RimpStatus = Field(default_factory=RimpStatus)
    warnings: list[str] = Field(default_factory=list)


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
