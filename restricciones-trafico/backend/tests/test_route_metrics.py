import unittest
from app.route_analysis import geometry_distance_km, analyze_route
from app.routing import RouteResult

class FakeProvider:
    hora_salida = "10:00"
    def route(self, origen, destino):
        return RouteResult(
            provider="fake",
            origin={"query": origen},
            destination={"query": destino},
            roads=["A-1", "A-2"],
            confidence="alta",
            warnings=[],
            geometry={"type":"LineString","coordinates":[[0,0],[0,1]]},
        )

class RouteMetricsTests(unittest.TestCase):
    def test_geometry_distance_km_from_linestring(self):
        self.assertAlmostEqual(geometry_distance_km({"coordinates":[[0,0],[0,1]]}), 111.195, places=2)

    def test_classic_analysis_returns_distance_and_eta(self):
        data = analyze_route("A", "B", "2026-06-15", "2026-06-15", provider=FakeProvider(), enrich_with_overpass=False)
        self.assertIn("distance_km", data)
        self.assertEqual(data["fixed_speed_kmh"], 78)
        self.assertEqual(data["eta_minutes"], 86)
        self.assertEqual(data["eta_at"], "2026-06-15T11:26:00+02:00")

if __name__ == "__main__":
    unittest.main()
