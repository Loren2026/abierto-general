import unittest
from pydantic import ValidationError

from app.alternative_routing import (
    RutaAlternativaRequest,
    calculate_eta,
    categories_from_ors_feature,
    road_category_from_name,
    score_road_categories,
    select_best_route,
)


class RutaAlternativaModelTests(unittest.TestCase):
    def test_request_model_defaults_vehicle_and_general_cargo(self):
        req = RutaAlternativaRequest(
            origen="Madrid",
            destino="Valencia",
            fecha_salida="2026-06-15",
            hora_salida="08:30",
        )
        self.assertEqual(req.cargo_type.value, "general")
        self.assertEqual(req.vehicle.mass_kg, 44000)
        self.assertEqual(req.vehicle.length_m, 17)
        self.assertEqual(req.vehicle.height_m, 4)

    def test_request_model_rejects_invalid_manual_time(self):
        with self.assertRaises(ValidationError):
            RutaAlternativaRequest(
                origen="Madrid",
                destino="Valencia",
                fecha_salida="2026-06-15",
                hora_salida="25:00",
            )


class EtaCalculationTests(unittest.TestCase):
    def test_eta_uses_distance_divided_by_fixed_78_kmh(self):
        result = calculate_eta(156, "2026-06-15", "08:30")
        self.assertEqual(result["fixed_speed_kmh"], 78)
        self.assertEqual(result["eta_minutes"], 120)
        self.assertEqual(result["eta_at"], "2026-06-15T10:30:00+02:00")

    def test_eta_rounds_minutes_from_manual_departure_time(self):
        result = calculate_eta(100, "2026-01-10", "23:00")
        self.assertEqual(result["eta_minutes"], 77)
        self.assertEqual(result["eta_at"], "2026-01-11T00:17:00+01:00")


class RoadCategoryScoringTests(unittest.TestCase):
    def test_motorway_scores_above_autovia_and_national_and_resto(self):
        autopista = score_road_categories(km_autopista=10)
        autovia = score_road_categories(km_autovia=10)
        nacional = score_road_categories(km_nacional=10)
        resto = score_road_categories(km_resto=10)
        self.assertGreater(autopista, autovia)
        self.assertGreater(autovia, nacional)
        self.assertGreater(nacional, resto)

    def test_local_roads_are_heavily_penalized(self):
        high_capacity_with_local = score_road_categories(km_autopista=100, km_comarcal_local=5)
        pure_autovia = score_road_categories(km_autovia=80)
        self.assertLess(high_capacity_with_local, pure_autovia)

    def test_m40_is_high_capacity_not_local_road(self):
        self.assertEqual(road_category_from_name("M-40"), "autovia")
        feature = {"properties": {"segments": [{"steps": [{"name": "M-40", "distance": 12000}]}]}}
        categories = categories_from_ors_feature(feature)
        self.assertEqual(categories["autovia"], 12)
        self.assertEqual(categories["comarcal_local"], 0)

    def test_select_best_route_discards_local_roads_when_viable_route_exists(self):
        best = select_best_route([
            {"id": "short-local", "distance_km": 80, "categories": {"autopista": 60, "comarcal_local": 20}},
            {"id": "long-high-capacity", "distance_km": 110, "categories": {"autovia": 110}},
        ])
        self.assertEqual(best["id"], "long-high-capacity")

    def test_select_best_route_prefers_shorter_inside_same_category_quality(self):
        best = select_best_route([
            {"id": "long", "distance_km": 120, "categories": {"autovia": 120}},
            {"id": "short", "distance_km": 100, "categories": {"autovia": 100}},
        ])
        self.assertEqual(best["id"], "short")


if __name__ == "__main__":
    unittest.main()
