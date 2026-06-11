import os
import unittest
from unittest.mock import patch

os.environ.setdefault("ORS_API_KEY", "test-key-not-real")

from app.alternative_routing import RutaAlternativaRequest  # noqa: E402
from app.main import app, post_ruta_alternativa  # noqa: E402


FAKE_ORS_RESPONSE = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[-3.7, 40.4], [-0.3, 39.4]]},
            "properties": {
                "summary": {"distance": 156000},
                "segments": [{"steps": [{"name": "A-3", "distance": 156000}]}],
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[-3.7, 40.4], [-1, 40], [-0.3, 39.4]]},
            "properties": {
                "summary": {"distance": 180000},
                "segments": [{"steps": [{"name": "AP-7", "distance": 180000}]}],
            },
        },
    ],
}


class FakeOrsClient:
    def __init__(self):
        self.calls = []

    def directions_hgv(self, coordinates, vehicle, avoid_polygons=None):
        self.calls.append({"coordinates": coordinates, "vehicle": vehicle, "avoid_polygons": avoid_polygons})
        return FAKE_ORS_RESPONSE


class RutaAlternativaEndpointTests(unittest.TestCase):
    def test_endpoint_is_registered_parallel_to_existing_analyze_endpoint(self):
        routes = {(route.path, tuple(sorted(route.methods))) for route in app.routes if hasattr(route, "methods")}
        self.assertIn(("/api/ruta/analizar", ("POST",)), routes)
        self.assertIn(("/api/ruta/alternativa", ("POST",)), routes)

    def test_endpoint_handler_uses_mocked_ors_and_returns_eta_and_scoring(self):
        fake_client = FakeOrsClient()
        req = RutaAlternativaRequest(
            origen="Madrid",
            destino="Valencia",
            fecha_salida="2026-06-15",
            hora_salida="08:30",
            vehicle={"mass_kg": 7500, "length_m": 17, "height_m": 4},
        )
        with patch("app.main.OpenRouteServiceClient", return_value=fake_client), patch("app.alternative_routing.geocode_es") as geocode:
            geocode.side_effect = [type("P", (), {"lon": -3.7, "lat": 40.4, "label": "Madrid"})(), type("P", (), {"lon": -0.3, "lat": 39.4, "label": "Valencia"})()]
            result = post_ruta_alternativa(req)
        self.assertEqual(result["provider"], "openrouteservice")
        self.assertEqual(result["vias_detectadas"], ["A-3"])
        self.assertEqual(result["route_confidence"], "alta")
        self.assertEqual(result["fixed_speed_kmh"], 78)
        self.assertEqual(result["original_route"]["distance_km"], 156)
        self.assertEqual(result["original_route"]["eta_minutes"], 120)
        self.assertEqual(result["original_route"]["eta_at"], "2026-06-15T10:30:00+02:00")
        self.assertTrue(result["alternative_route"]["selected"])
        self.assertEqual(result["alternative_route"]["distance_km"], 180)
        self.assertGreater(result["alternative_route"]["road_category_score"], result["original_route"]["road_category_score"])
        self.assertEqual(fake_client.calls[0]["vehicle"].mass_kg, 7500)
        self.assertEqual(fake_client.calls[0]["vehicle"].length_m, 17)
        self.assertEqual(fake_client.calls[0]["vehicle"].height_m, 4)


if __name__ == "__main__":
    unittest.main()
