import json
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("ORS_API_KEY", "test-key-not-real")

from app.crossed_restrictions import crossed_restrictions_for_route  # noqa: E402


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
        self.assertEqual(crossed, sqlite_result)


if __name__ == "__main__":
    unittest.main()
