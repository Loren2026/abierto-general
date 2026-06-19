import unittest

from app.route_segmentation import merge_ors_segment_responses, split_linestring_by_distance


class RouteSegmentationTests(unittest.TestCase):
    def test_short_linestring_stays_one_segment(self):
        segments = split_linestring_by_distance([[-3.7, 40.4], [-3.6, 40.4]], max_km=140)
        self.assertEqual(len(segments), 1)

    def test_long_linestring_is_split_preserving_order(self):
        coords = [[-3.0, 40.0], [-1.5, 40.0], [0.0, 40.0], [1.5, 40.0]]
        segments = split_linestring_by_distance(coords, max_km=140)
        self.assertGreater(len(segments), 1)
        self.assertEqual(segments[0][0], coords[0])
        self.assertEqual(segments[-1][-1], coords[-1])

    def test_merge_ors_segment_responses_deduplicates_join_point(self):
        responses = [
            {"features": [{"geometry": {"coordinates": [[0, 0], [1, 0]]}, "properties": {"summary": {"distance": 1000, "duration": 10}, "segments": [{"steps": [{"name": "A-1", "distance": 1000}]}]}}]},
            {"features": [{"geometry": {"coordinates": [[1, 0], [2, 0]]}, "properties": {"summary": {"distance": 2000, "duration": 20}, "segments": [{"steps": [{"name": "A-2", "distance": 2000}]}]}}]},
        ]
        merged = merge_ors_segment_responses(responses)
        feature = merged["features"][0]
        self.assertEqual(feature["geometry"]["coordinates"], [[0, 0], [1, 0], [2, 0]])
        self.assertEqual(feature["properties"]["summary"]["distance"], 3000)
        self.assertEqual(len(feature["properties"]["segments"]), 2)

    def test_merge_ors_segment_responses_deduplicates_near_join_point_with_tolerance(self):
        responses = [
            {"features": [{"geometry": {"coordinates": [[0, 0], [1, 0]]}, "properties": {"summary": {"distance": 1000, "duration": 10}, "segments": []}}]},
            {"features": [{"geometry": {"coordinates": [[1.00005, 0], [2, 0]]}, "properties": {"summary": {"distance": 2000, "duration": 20}, "segments": []}}]},
        ]
        merged = merge_ors_segment_responses(responses)
        feature = merged["features"][0]
        self.assertEqual(feature["geometry"]["coordinates"], [[0, 0], [1, 0], [2, 0]])


if __name__ == "__main__":
    unittest.main()
