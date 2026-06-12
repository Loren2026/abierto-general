import io
import os
import unittest
import urllib.error
from unittest.mock import patch

os.environ.setdefault("ORS_API_KEY", "test-key-not-real")

from app.alternative_routing import RutaAlternativaRequest  # noqa: E402
from app.main import app, post_ruta_alternativa, post_ruta_analizar, RutaAnalizarRequest  # noqa: E402
from app.ors_client import OpenRouteServiceClient, ORS_SNAP_RADIUS_METERS  # noqa: E402


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

    def test_endpoint_returns_400_for_ambiguous_geocoding(self):
        req = RutaAlternativaRequest(
            origen="Asturias",
            destino="aranjuez",
            fecha_salida="2026-06-15",
            hora_salida="08:30",
        )
        with patch("app.main.OpenRouteServiceClient", return_value=FakeOrsClient()), patch("app.alternative_routing.geocode_es", side_effect=ValueError("Geocodificación ambigua para 'aranjuez'. Añade provincia o localidad, por ejemplo 'Aranjuez, Madrid'.")):
            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as ctx:
                post_ruta_alternativa(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Añade provincia", ctx.exception.detail)

    def test_original_ors_404_returns_honest_502_detail(self):
        req = RutaAlternativaRequest(
            origen="Madrid",
            destino="Llambilles",
            fecha_salida="2026-06-15",
            hora_salida="08:30",
        )
        def fake_urlopen(_req, timeout=30):
            body = b'{"error":{"code":2010,"message":"Could not find routable point within a radius of 1500.0 meters of specified coordinate 1."}}'
            raise urllib.error.HTTPError("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", 404, "Not Found", {}, io.BytesIO(body))

        with patch("app.alternative_routing.geocode_es") as geocode, patch("urllib.request.urlopen", side_effect=fake_urlopen):
            geocode.side_effect = [type("P", (), {"lon": -3.7, "lat": 40.4, "label": "Madrid"})(), type("P", (), {"lon": 2.85, "lat": 41.92, "label": "Llambilles"})()]
            from fastapi import HTTPException
            with self.assertRaises(HTTPException) as ctx:
                post_ruta_alternativa(req)
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail["provider"], "openrouteservice")
        self.assertEqual(ctx.exception.detail["status_code"], 404)
        self.assertEqual(ctx.exception.detail["ors_code"], 2010)
        self.assertIn("Could not find routable point", ctx.exception.detail["message"])
        self.assertIn("municipio mayor", ctx.exception.detail["suggestion"])

    def test_ors_client_sends_1500m_radiuses_for_small_town_snapping(self):
        captured = {}

        class FakeResponse:
            def __enter__(self):
                return self
            def __exit__(self, exc_type, exc, tb):
                return False
            def read(self):
                return b'{"type":"FeatureCollection","features":[]}'

        def fake_urlopen(req, timeout=30):
            captured["body"] = req.data
            return FakeResponse()

        client = OpenRouteServiceClient(api_key="test")
        req = RutaAlternativaRequest(origen="Madrid", destino="Llambilles", fecha_salida="2026-06-15", hora_salida="08:30")
        with patch("urllib.request.urlopen", side_effect=fake_urlopen):
            client.directions_hgv([[-3.7, 40.4], [2.85, 41.92]], req.vehicle)
        import json
        body = json.loads(captured["body"].decode("utf-8"))
        self.assertEqual(body["radiuses"], [ORS_SNAP_RADIUS_METERS, ORS_SNAP_RADIUS_METERS])

    def test_classic_analysis_endpoint_still_uses_analyze_route(self):
        req = RutaAnalizarRequest(origen="Madrid", destino="Valencia", fecha_salida="2026-06-15", fecha_llegada="2026-06-15", hora_salida="08:30")
        with patch("app.main.analyze_route", return_value={"provider": "classic-ok"}) as analyze:
            result = post_ruta_analizar(req)
        self.assertEqual(result, {"provider": "classic-ok"})
        self.assertTrue(analyze.called)


if __name__ == "__main__":
    unittest.main()
