import unittest
from app.adr_calendar import adr_calendar_warnings

class AdrCalendarTests(unittest.TestCase):
    def test_adr_warns_on_sunday_afternoon(self):
        warnings = adr_calendar_warnings("2026-07-05", "16:00", 60)
        self.assertTrue(any("domingo de 15:00" in w for w in warnings))
        self.assertTrue(any("Anexo V" in w for w in warnings))

    def test_adr_is_informative_not_blocking(self):
        warnings = adr_calendar_warnings("2026-07-06", "10:00", 60)
        self.assertTrue(any("no bloquea" in w for w in warnings))

if __name__ == "__main__":
    unittest.main()
