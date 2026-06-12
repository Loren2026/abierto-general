import json
import os
import time
import unittest
from unittest.mock import patch

os.environ.setdefault("ORS_API_KEY", "test-key-not-real")

from app.crossed_restrictions import crossed_restrictions_for_route  # noqa: E402
from app.alternative_routing import RutaAlternativaRequest  # noqa: E402


ROUTE_GEOMETRY = {"type": "LineString", "coordinates": [[-3.7, 40.4], [-3.0, 40.0], [-0.3, 39.4]]}


class CrossedRestrictionsTests(unittest.TestCase):
    def test_crossed_status_unchecked_when_supabase_missing(self):
        with patch("app.crossed_restrictions.supabase_configured", return_value=False):
            crossed, status = crossed_restrictions_for_route(ROUTE_GEOMETRY, "2026-06-15", "2026-06-15")
        self.assertEqual(crossed, [])
        self.assertFalse(status["checked"])
        self.assertIn("Supabase no configurado", status["reason"])

    def test_crossed_restrictions_intersects_supabase_geometry_and_reuses_sqlite_logic(self):
        records = [{
            "id": "geom-1",
            "restriction_id": "dgt-a3-1",
            "road_normalized": "A-3",
            "geometry_geojson": json.dumps({"type": "LineString", "coordinates": [[-3.01, 40.0], [-3.0, 40.0]]}),
        }]
        sqlite_result = [{"id": "dgt-a3-1", "via": "A-3", "dias_afecta": ["2026-06-15"]}]
        with patch("app.crossed_restrictions.supabase_configured", return_value=True), \
             patch("app.crossed_restrictions.fetch_restriction_geometries", return_value=records) as fetch, \
             patch("app.crossed_restrictions.consulta", return_value=sqlite_result) as consulta:
            crossed, status = crossed_restrictions_for_route(ROUTE_GEOMETRY, "2026-06-15", "2026-06-15")
        fetch.assert_called_once_with(limit=12, confidence=None)
        consulta.assert_called_once_with("2026-06-15", "2026-06-15", ["A-3"])
        self.assertTrue(status["checked"])
        self.assertEqual(status["geometry_count"], 1)
        self.assertIn("1 geometrías", status["reason"])
        self.assertEqual(crossed, sqlite_result)

    def test_clean_route_reason_reports_partial_geometry_count(self):
        records = [{
            "id": "geom-far",
            "restriction_id": "dgt-far",
            "road_normalized": "A-3",
            "geometry_geojson": json.dumps({"type": "LineString", "coordinates": [[10.0, 50.0], [10.1, 50.1]]}),
        }]
        with patch("app.crossed_restrictions.supabase_configured", return_value=True), \
             patch("app.crossed_restrictions.fetch_restriction_geometries", return_value=records):
            crossed, status = crossed_restrictions_for_route(ROUTE_GEOMETRY, "2026-06-15", "2026-06-15")
        self.assertEqual(crossed, [])
        self.assertTrue(status["checked"])
        self.assertEqual(status["geometry_count"], 1)
        self.assertIn("cobertura parcial", status["reason"])

    def test_synthetic_long_route_performance_under_one_second(self):
        route = {"type": "LineString", "coordinates": [[-8 + i * 0.001, 38.0 + i * 0.0001] for i in range(5000)]}
        records = []
        for idx in range(12):
            lon = -7.9 + idx * 0.02
            lat = 38.01 + idx * 0.002
            records.append({
                "id": f"geom-{idx}",
                "restriction_id": f"restr-{idx}",
                "road_normalized": "A-3",
                "geometry_geojson": json.dumps({"type": "LineString", "coordinates": [[lon, lat], [lon + 0.001, lat + 0.001]]}),
            })
        with patch("app.crossed_restrictions.supabase_configured", return_value=True), \
             patch("app.crossed_restrictions.fetch_restriction_geometries", return_value=records), \
             patch("app.crossed_restrictions.consulta", return_value=[]):
            start = time.perf_counter()
            crossed_restrictions_for_route(route, "2026-06-15", "2026-06-15")
            elapsed = time.perf_counter() - start
        self.assertLess(elapsed, 1.0)

    def test_fecha_llegada_defaults_to_fecha_salida(self):
        req = RutaAlternativaRequest(origen="Madrid", destino="Valencia", fecha_salida="2026-06-15", hora_salida="08:30")
        self.assertEqual(req.fecha_llegada, "2026-06-15")


if __name__ == "__main__":
    unittest.main()
