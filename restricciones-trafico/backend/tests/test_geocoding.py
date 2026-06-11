import unittest
from urllib.parse import parse_qs, urlparse

from app.geocoding import geocode_es


def item(name, lon, lat, importance="0.5"):
    return {"display_name": name, "lon": str(lon), "lat": str(lat), "importance": importance, "class": "place"}


class GeocodingTests(unittest.TestCase):
    def test_lugones_asturias_prefers_asturias_and_countrycodes_es(self):
        seen = {}
        def fake(url):
            seen.update(parse_qs(urlparse(url).query))
            return [
                item("Lugones, Siero, Asturias, España", -5.812, 43.405, "0.6"),
                item("Lugones, otro lugar, España", -3.7, 40.4, "0.7"),
            ]
        result = geocode_es("Lugones, Asturias", fetch_json=fake)
        self.assertEqual(result.lon, -5.812)
        self.assertEqual(seen["countrycodes"], ["es"])
        self.assertEqual(seen["limit"], ["5"])
        self.assertIn("viewbox", seen)

    def test_aranjuez_madrid_prefers_madrid(self):
        def fake(url):
            return [
                item("Aranjuez, Comunidad de Madrid, España", -3.604, 40.034, "0.6"),
                item("Aranjuez, provincia equivocada, España", -0.2, 38.9, "0.8"),
            ]
        result = geocode_es("Aranjuez, Madrid", fetch_json=fake)
        self.assertAlmostEqual(result.lon, -3.604)

    def test_lowercase_ambiguous_aranjuez_asks_for_more_context(self):
        def fake(url):
            return [
                item("Aranjuez, Comunidad de Madrid, España", -3.604, 40.034, "0.6"),
                item("Aranjuez, otro resultado, España", -0.2, 38.9, "0.6"),
            ]
        with self.assertRaisesRegex(ValueError, "ambigua"):
            geocode_es("aranjuez", fetch_json=fake)


if __name__ == "__main__":
    unittest.main()
