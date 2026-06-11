import json
import os
import urllib.request
from typing import Any

from .alternative_routing import RoutingVehicle


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
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
