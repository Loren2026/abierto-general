import unittest
from unittest.mock import patch

from app.heavy_vehicle_calendar import general_heavy_vehicle_calendar_warnings
from app.alternative_routing import RutaAlternativaRequest, calculate_alternative_route


class HeavyVehicleCalendarTests(unittest.TestCase):
    def test_general_heavy_vehicle_warns_on_sunday(self):
        warnings = general_heavy_vehicle_calendar_warnings(
            "2026-06-21",
            "17:00",
            60,
            cargo_type="general",
            mass_kg=7501,
        )
        self.assertTrue(any("Calendario general de pesados" in warning for warning in warnings))
        self.assertTrue(any("domingo/festivo" in warning for warning in warnings))

    def test_general_heavy_vehicle_does_not_warn_for_light_vehicle(self):
        warnings = general_heavy_vehicle_calendar_warnings(
            "2026-06-21",
            "17:00",
            60,
            cargo_type="general",
            mass_kg=7500,
        )
        self.assertEqual(warnings, [])

    def test_calculate_route_adds_general_heavy_warning(self):
        class FakeOrsClient:
            def directions_hgv(self, coordinates, vehicle, avoid_polygons=None):
                return {
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "geometry": {"type": "LineString", "coordinates": [[-5.8, 43.3], [-2.9, 43.2]]},
                        "properties": {"summary": {"distance": 293300, "duration": 100}, "segments": [{"steps": [{"name": "A-8", "distance": 293300}]}]},
                    }],
                }

        req = RutaAlternativaRequest(
            origen="Asturias",
            destino="Bilbao",
            fecha_salida="2026-06-21",
            hora_salida="17:00",
            vehicle={"mass_kg": 7501, "length_m": 17, "height_m": 4},
        )
        with patch("app.alternative_routing.geocode_es") as geocode, \
             patch("app.alternative_routing.supabase_configured", return_value=True), \
             patch("app.alternative_routing.crossed_restrictions_for_route", return_value=([], {"checked": True, "reason": "mock", "intersected_roads": [], "intersected_restriction_ids": []})):
            geocode.side_effect = [type("P", (), {"lon": -5.8, "lat": 43.3, "label": "Asturias"})(), type("P", (), {"lon": -2.9, "lat": 43.2, "label": "Bilbao"})()]
            result = calculate_alternative_route(req, FakeOrsClient())
        self.assertTrue(any("Calendario general de pesados" in warning for warning in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
