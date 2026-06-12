import json
import os
import urllib.error
import urllib.request
from typing import Any

from .alternative_routing import RoutingVehicle

ORS_SNAP_RADIUS_METERS = 1500


class OrsApiError(RuntimeError):
    """Error tipado de ORS con detalle legible para API/PWA."""

    def __init__(self, status_code: int | None, ors_code: int | None, message: str, raw_body: str | None = None):
        self.status_code = status_code
        self.ors_code = ors_code
        self.message = message
        self.raw_body = raw_body
        super().__init__(message)

    def to_public_detail(self) -> dict[str, Any]:
        return {
            "provider": "openrouteservice",
            "status_code": self.status_code,
            "ors_code": self.ors_code,
            "message": self.message,
            "suggestion": "Prueba con un municipio mayor o un punto sobre carretera.",
        }


class OpenRouteServiceClient:
    """Backend-only ORS client for driving-hgv routing."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.getenv("ORS_API_KEY")
        self.base_url = (base_url or os.getenv("ORS_BASE_URL") or "https://api.openrouteservice.org").rstrip("/")
        if not self.api_key:
            raise ValueError("ORS_API_KEY no configurada")

    def directions_hgv(self, coordinates: list[list[float]], vehicle: RoutingVehicle, avoid_polygons: dict[str, Any] | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "coordinates": coordinates,
            "profile": "driving-hgv",
            "format": "geojson",
            "instructions": True,
            # 1500 m permite enganchar geocodificaciones de pueblos pequeños a vías HGV cercanas
            # sin usar -1 (ilimitado), que puede enganchar a un punto demasiado lejano y confuso.
            "radiuses": [ORS_SNAP_RADIUS_METERS for _ in coordinates],
            "options": {
                "profile_params": {
                    "restrictions": {
                        "height": vehicle.height_m,
                        "length": vehicle.length_m,
                        "weight": vehicle.mass_kg / 1000,
                    }
                }
            },
        }
        if avoid_polygons:
            body["options"]["avoid_polygons"] = avoid_polygons

        req = urllib.request.Request(
            f"{self.base_url}/v2/directions/driving-hgv/geojson",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json, application/geo+json",
                "User-Agent": "restricciones-trafico/ors-prototype",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace")
            ors_code = None
            message = raw_body or str(exc)
            try:
                parsed = json.loads(raw_body)
                error = parsed.get("error") or parsed
                ors_code = error.get("code")
                message = error.get("message") or parsed.get("message") or message
            except json.JSONDecodeError:
                pass
            raise OrsApiError(exc.code, ors_code, message, raw_body) from exc
