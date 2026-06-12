import json
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("ORS_API_KEY", "test-key-not-real")

from app.alternative_routing import RutaAlternativaRequest, calculate_alternative_route  # noqa: E402
from app.supabase_geometries import build_avoid_polygons  # noqa: E402


ORIGINAL_ORS_RESPONSE = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[-3.7, 40.4], [-0.3, 39.4]]},
        "properties": {"summary": {"distance": 156000}, "segments": [{"steps": [{"name": "A-3", "distance": 156000}]}]},
    }],
}

AVOID_ORS_RESPONSE = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[-3.7, 40.4], [-1.0, 40.0], [-0.3, 39.4]]},
        "properties": {"summary": {"distance": 180000}, "segments": [{"steps": [{"name": "AP-7", "distance": 180000}]}]},
    }],
}


def polygon_record(idx=1):
    return {
        "id": f"geom-{idx}",
        "restriction_id": f"restr-{idx}",
        "road_normalized": "A-3",
        "confidence": "alta",
        "buffer_geojson": json.dumps({
            "type": "Polygon",
            "coordinates": [[[-3.01, 40.00], [-3.00, 40.00], [-3.00, 40.01], [-3.01, 40.01], [-3.01, 40.00]]],
        }),
    }


class FakeOrsClient:
    def __init__(self, fail_avoid=False):
        self.calls = []
        self.fail_avoid = fail_avoid

    def directions_hgv(self, coordinates, vehicle, avoid_polygons=None):
        self.calls.append({"coordinates": coordinates, "avoid_polygons": avoid_polygons})
        if avoid_polygons:
            if self.fail_avoid:
                raise RuntimeError("no route found")
            return AVOID_ORS_RESPONSE
        return ORIGINAL_ORS_RESPONSE


class OrsAvoidPolygonsTests(unittest.TestCase):
    def setUp(self):
        self.req = RutaAlternativaRequest(origen="Madrid", destino="Valencia", fecha_salida="2026-06-15", hora_salida="08:30")

    def test_build_avoid_polygons_returns_multipolygon_and_used_records(self):
        avoid, used, warnings = build_avoid_polygons([polygon_record(i) for i in range(1, 10)])
        self.assertEqual(avoid["type"], "MultiPolygon")
        self.assertEqual(len(avoid["coordinates"]), 9)
        self.assertEqual(len(used), 9)
        self.assertEqual(warnings, [])

    def test_calculate_route_calls_ors_original_and_alternative_with_avoid_polygons(self):
        fake_client = FakeOrsClient()
        with patch("app.alternative_routing.geocode_es") as geocode, \
             patch("app.alternative_routing.supabase_configured", return_value=True), \
             patch("app.alternative_routing.fetch_high_confidence_geometries", return_value=[polygon_record(i) for i in range(1, 10)]):
            geocode.side_effect = [type("P", (), {"lon": -3.7, "lat": 40.4, "label": "Madrid"})(), type("P", (), {"lon": -0.3, "lat": 39.4, "label": "Valencia"})()]
            result = calculate_alternative_route(self.req, fake_client)
        self.assertEqual(len(fake_client.calls), 2)
        self.assertIsNone(fake_client.calls[0]["avoid_polygons"])
        self.assertEqual(fake_client.calls[1]["avoid_polygons"]["type"], "MultiPolygon")
        self.assertTrue(result["alternative_status"]["found"])
        self.assertTrue(result["alternative_status"]["avoid_polygons"])
        self.assertEqual(len(result["avoid_polygons_used"]), 9)
        self.assertEqual(result["alternative_route"]["distance_km"], 180)

    def test_ors_avoid_failure_keeps_original_and_reports_concrete_reason(self):
        fake_client = FakeOrsClient(fail_avoid=True)
        with patch("app.alternative_routing.geocode_es") as geocode, \
             patch("app.alternative_routing.supabase_configured", return_value=True), \
             patch("app.alternative_routing.fetch_high_confidence_geometries", return_value=[polygon_record()]):
            geocode.side_effect = [type("P", (), {"lon": -3.7, "lat": 40.4, "label": "Madrid"})(), type("P", (), {"lon": -0.3, "lat": 39.4, "label": "Valencia"})()]
            result = calculate_alternative_route(self.req, fake_client)
        self.assertEqual(result["original_route"]["distance_km"], 156)
        self.assertIsNone(result["alternative_route"])
        self.assertFalse(result["alternative_status"]["found"])
        self.assertIn("no route found", result["alternative_status"]["reason"])


if __name__ == "__main__":
    unittest.main()
