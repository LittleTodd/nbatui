"""Tests for timezone-aware date conversion and NBA date candidates."""
import unittest

from tests.helpers import set_timezone

from services.timezone_utils import (
    et_utc_offset,
    hours_ahead_of_et,
    local_utc_offset,
    nba_date_candidates,
    utc_to_et_date,
    utc_to_local_date,
    utc_to_local_time,
)


class UTCParsingTest(unittest.TestCase):
    def test_accepts_z_suffix(self):
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(utc_to_local_date("2026-01-06T03:00:00Z"), "2026-01-06")

    def test_accepts_explicit_offset(self):
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(
                utc_to_local_date("2026-01-06T03:00:00+00:00"), "2026-01-06"
            )

    def test_treats_naive_timestamp_as_utc(self):
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(utc_to_local_date("2026-01-06T03:00:00"), "2026-01-06")

    def test_accepts_date_only(self):
        with set_timezone("America/New_York"):
            # UTC midnight on Jan 6 is still Jan 5 in New York.
            self.assertEqual(utc_to_local_date("2026-01-06"), "2026-01-05")


class LocalDateTest(unittest.TestCase):
    def test_shanghai_rolls_evening_et_games_into_next_day(self):
        # 7:00 PM ET on Jan 5 == 8:00 AM Jan 6 in Shanghai.
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(utc_to_local_date("2026-01-06T00:00:00Z"), "2026-01-06")
            self.assertEqual(utc_to_local_time("2026-01-06T00:00:00Z"), "8:00 AM")

    def test_new_york_keeps_evening_et_game_on_same_day(self):
        with set_timezone("America/New_York"):
            self.assertEqual(utc_to_local_date("2026-01-06T00:00:00Z"), "2026-01-05")
            self.assertEqual(utc_to_local_time("2026-01-06T00:00:00Z"), "7:00 PM")

    def test_london_splits_across_local_days(self):
        # 7:00 PM ET Jan 5 == 00:00 Jan 6 in London.
        with set_timezone("Europe/London"):
            self.assertEqual(utc_to_local_date("2026-01-06T00:00:00Z"), "2026-01-06")
            self.assertEqual(utc_to_local_date("2026-01-06T03:00:00Z"), "2026-01-06")
            self.assertEqual(utc_to_local_date("2026-01-05T17:30:00Z"), "2026-01-05")

    def test_los_angeles_keeps_afternoon_et_game_on_same_day(self):
        with set_timezone("America/Los_Angeles"):
            self.assertEqual(utc_to_local_date("2026-01-05T17:30:00Z"), "2026-01-05")
            self.assertEqual(utc_to_local_date("2026-01-06T03:00:00Z"), "2026-01-05")


class ETDateTest(unittest.TestCase):
    def test_et_date_is_independent_of_local_timezone(self):
        tipoff = "2026-01-06T03:00:00Z"  # 10:00 PM ET Jan 5
        for tz in ("Asia/Shanghai", "America/New_York", "Europe/London"):
            with set_timezone(tz):
                self.assertEqual(utc_to_et_date(tipoff), "2026-01-05", msg=tz)

    def test_et_date_handles_dst(self):
        # 10:00 PM EDT on Jun 30.
        self.assertEqual(utc_to_et_date("2026-07-01T02:00:00Z"), "2026-06-30")

    def test_et_offset_changes_with_dst(self):
        self.assertEqual(et_utc_offset("2026-01-05").total_seconds(), -5 * 3600)
        self.assertEqual(et_utc_offset("2026-07-01").total_seconds(), -4 * 3600)


class OffsetTest(unittest.TestCase):
    def test_offsets(self):
        cases = {
            "Asia/Shanghai": 8,
            "America/New_York": -5,
            "Europe/London": 0,
            "America/Los_Angeles": -8,
        }
        for tz, expected in cases.items():
            with set_timezone(tz):
                actual = local_utc_offset("2026-01-05").total_seconds() / 3600
                self.assertEqual(actual, expected, msg=tz)

    def test_hours_ahead_of_et(self):
        cases = {
            "Asia/Shanghai": 13,
            "America/New_York": 0,
            "Europe/London": 5,
            "America/Los_Angeles": -3,
        }
        for tz, expected in cases.items():
            with set_timezone(tz):
                self.assertEqual(hours_ahead_of_et("2026-01-05"), expected, msg=tz)

    def test_hours_ahead_of_et_accounts_for_dst_mismatch(self):
        # London is +1 while New York is -4 in July: still 5 hours.
        with set_timezone("Europe/London"):
            self.assertEqual(hours_ahead_of_et("2026-07-01"), 5)


class NBADateCandidatesTest(unittest.TestCase):
    def test_asia_uses_previous_et_day(self):
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(nba_date_candidates("2026-01-06"), ["2026-01-05"])

    def test_us_uses_same_et_day(self):
        for tz in ("America/New_York", "America/Los_Angeles"):
            with set_timezone(tz):
                self.assertEqual(
                    nba_date_candidates("2026-01-05"), ["2026-01-05"], msg=tz
                )

    def test_europe_checks_both_days(self):
        with set_timezone("Europe/London"):
            self.assertEqual(
                nba_date_candidates("2026-01-06"),
                ["2026-01-05", "2026-01-06"],
            )

    def test_invalid_input_falls_back_to_input(self):
        with set_timezone("Asia/Shanghai"):
            self.assertEqual(nba_date_candidates("not-a-date"), ["not-a-date"])


if __name__ == "__main__":
    unittest.main()
