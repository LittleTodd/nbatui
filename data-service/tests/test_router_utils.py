import unittest
from routers.games import _parse_clock_seconds


class ScoreCurveClockParsingTest(unittest.TestCase):
    def test_regular_period_clock_parsing(self):
        self.assertEqual(_parse_clock_seconds("PT12M00.00S", 1), 720.0)
        self.assertEqual(_parse_clock_seconds("PT05M30.00S", 2), 330.0)
        self.assertEqual(_parse_clock_seconds("PT00M00.00S", 4), 0.0)

    def test_under_one_minute_clock_parsing(self):
        self.assertEqual(_parse_clock_seconds("PT45.20S", 1), 45.2)
        self.assertEqual(_parse_clock_seconds("PT00M15.50S", 3), 15.5)

    def test_overtime_clock_parsing(self):
        self.assertEqual(_parse_clock_seconds("PT05M00.00S", 5), 300.0)
        self.assertEqual(_parse_clock_seconds("PT02M30.00S", 5), 150.0)

    def test_invalid_clock_fallback(self):
        self.assertEqual(_parse_clock_seconds("invalid", 1), 720.0)
        self.assertEqual(_parse_clock_seconds("invalid", 5), 300.0)
        self.assertEqual(_parse_clock_seconds(None, 1), 720.0)


if __name__ == "__main__":
    unittest.main()
