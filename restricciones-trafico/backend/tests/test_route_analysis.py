import unittest
from app.route_analysis import analyze_route
from app.routing import RouteResult

class FakeProvider:
    def __init__(self, roads):
        self.roads = roads
    def route(self, origin, destination):
        return RouteResult(
            provider="fake-test",
            origin={"label": origin, "lat": 0, "lon": 0},
            destination={"label": destination, "lat": 1, "lon": 1},
            geometry={"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
            roads=self.roads,
            confidence="alta",
            warnings=[],
        )

class RouteAnalysisTests(unittest.TestCase):
    def test_asturias_madrid_detects_a6_ap6_restrictions(self):
        result = analyze_route("Oviedo", "Madrid", "2026-08-15", "2026-08-15", provider=FakeProvider(["A-66", "AP-66", "A-6", "AP-6"]), enrich_with_overpass=False)
        self.assertEqual(result["vias_detectadas"], ["A-66", "AP-66", "A-6", "AP-6"])
        self.assertGreater(result["summary"]["total_restricciones"], 0)
        self.assertTrue(any(item["via"] in {"A-6", "AP-6"} for item in result["restricciones"]))
        self.assertTrue(all(item["confidence"] in {"alta", "media", "baja"} for item in result["restricciones"]))

    def test_asturias_levante_detects_a3_restrictions(self):
        result = analyze_route("Oviedo", "Valencia", "2026-08-15", "2026-08-15", provider=FakeProvider(["A-66", "A-6", "M-50", "A-3"]), enrich_with_overpass=False)
        self.assertIn("A-3", result["vias_detectadas"])
        self.assertTrue(any(item["via"] == "A-3" for item in result["restricciones"]))

    def test_pais_vasco_detects_restrictions_and_exposes_loren_flag(self):
        result = analyze_route("Bilbao", "Donostia", "2026-08-15", "2026-08-15", provider=FakeProvider(["A-8", "AP-8", "N-240"]), enrich_with_overpass=False)
        self.assertTrue(any(item["source_scope"] == "PAIS_VASCO" for item in result["restricciones"]))
        self.assertTrue(all("aplica_a_loren" in item for item in result["restricciones"]))

if __name__ == "__main__":
    unittest.main()
