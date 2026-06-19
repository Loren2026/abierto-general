import unittest

from app.alternative_routing import RutaAlternativaRequest, build_ruta_alternativa_response, road_segments_from_ors_feature


FEATURE_WITH_WAYPOINTS = {
    "type": "Feature",
    "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 0], [2, 0], [3, 0]]},
    "properties": {
        "summary": {"distance": 3000},
        "segments": [{"steps": [
            {"name": "A-1", "distance": 1000, "way_points": [0, 1]},
            {"name": "AP-2", "distance": 2000, "way_points": [1, 3]},
        ]}],
    },
}


class RoadSegmentsTests(unittest.TestCase):
    def setUp(self):
        self.req = RutaAlternativaRequest(origen="A", destino="B", fecha_salida="2026-06-21", hora_salida="10:00")

    def test_road_segments_are_cut_from_way_points(self):
        segments = road_segments_from_ors_feature(FEATURE_WITH_WAYPOINTS)
        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0]["road"], "A-1")
        self.assertEqual(segments[0]["geometry"]["coordinates"], [[0, 0], [1, 0]])
        self.assertEqual(segments[1]["geometry"]["coordinates"], [[1, 0], [2, 0], [3, 0]])
        self.assertEqual(segments[1]["distance_km"], 2.0)

    def test_original_segments_mark_restrictions(self):
        restrictions = [{"id": "r-1", "via": "A-1", "restriction_type": "test"}]
        segments = road_segments_from_ors_feature(FEATURE_WITH_WAYPOINTS, restrictions, include_restrictions=True)
        self.assertTrue(segments[0]["restricted"])
        self.assertEqual(segments[0]["restrictions"], restrictions)
        self.assertFalse(segments[1]["restricted"])
        self.assertEqual(segments[1]["restrictions"], [])

    def test_segments_under_one_km_are_filtered_out(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[0, 0], [0.5, 0], [1, 0], [2, 0]]},
            "properties": {"summary": {"distance": 2500}, "segments": [{"steps": [
                {"name": "short-link", "distance": 200, "way_points": [0, 1]},
                {"name": "A-1", "distance": 2300, "way_points": [1, 3]},
            ]}]},
        }
        segments = road_segments_from_ors_feature(feature)
        self.assertEqual([item["road"] for item in segments], ["A-1"])

    def test_fallback_without_way_points_returns_empty_segments(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[0, 0], [1, 0]]},
            "properties": {"summary": {"distance": 1000}, "segments": [{"steps": [{"name": "A-1", "distance": 1000}]}]},
        }
        self.assertEqual(road_segments_from_ors_feature(feature), [])

    def test_response_exposes_original_and_alternative_segments_and_roads(self):
        alt_feature = {
            **FEATURE_WITH_WAYPOINTS,
            "properties": {"summary": {"distance": 3000}, "segments": [{"steps": [{"name": "N-3", "distance": 3000, "way_points": [0, 3]}]}]},
        }
        response = build_ruta_alternativa_response(
            self.req,
            {"features": [FEATURE_WITH_WAYPOINTS]},
            alternative_ors_data={"features": [alt_feature]},
            crossed_restrictions=[{"id": "r-1", "via": "A-1"}],
        )
        self.assertEqual([item["road"] for item in response["road_segments"]["original"]], ["A-1", "AP-2"])
        self.assertTrue(response["road_segments"]["original"][0]["restricted"])
        self.assertEqual([item["road"] for item in response["road_segments"]["alternative"]], ["N-3"])
        self.assertEqual(response["alternative_route"]["roads"], ["N-3"])
        self.assertEqual(response["vias_detectadas"], ["A-1", "AP-2"])


if __name__ == "__main__":
    unittest.main()
