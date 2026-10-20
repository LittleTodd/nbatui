"""Tests for the season schedule index and its date mapping."""
import os
import sqlite3
import tempfile
import unittest
from unittest import mock

from tests.helpers import set_timezone

from services import cache_service, schedule_service
from services.schedule_service import ScheduleIndex, season_for_date

GAMES = [
    # 7:30 PM ET Jan 5 -> 8:30 AM Jan 6 in Shanghai
    {"gameId": "001", "gameDateTimeUTC": "2026-01-06T00:30:00Z"},
    # 12:30 PM ET Jan 5
    {"gameId": "002", "gameDateTimeUTC": "2026-01-05T17:30:00Z"},
    # 5:00 PM ET Jan 5
    {"gameId": "003", "gameDateTimeUTC": "2026-01-05T22:00:00Z"},
    # 10:00 PM ET Jan 5
    {
        "gameId": "004",
        "gameDateTimeUTC": "2026-01-06T03:00:00Z",
        "homeTeam": {"teamTricode": "LAL"},
        "awayTeam": {"teamTricode": "BOS"},
    },
    # 12:30 PM ET Jan 6 -> 1:30 AM Jan 7 in Shanghai
    {"gameId": "005", "gameDateTimeUTC": "2026-01-06T17:30:00Z"},
]


class SeasonForDateTest(unittest.TestCase):
    def test_season_starts_in_october(self):
        self.assertEqual(season_for_date("2025-10-01"), "2025-26")
        self.assertEqual(season_for_date("2026-01-05"), "2025-26")
        self.assertEqual(season_for_date("2026-06-30"), "2025-26")
        self.assertEqual(season_for_date("2026-09-30"), "2025-26")
        self.assertEqual(season_for_date("2026-10-01"), "2026-27")


class ScheduleIndexTest(unittest.TestCase):
    def test_shanghai_date_maps_to_previous_et_date(self):
        with set_timezone("Asia/Shanghai"):
            index = ScheduleIndex("2025-26", GAMES)
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-06"),
                {"001", "002", "003", "004"},
            )
            self.assertEqual(
                index.et_dates_for_local_date("2026-01-06"), ["2026-01-05"]
            )
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-07"), {"005"}
            )

    def test_new_york_date_maps_to_same_et_date(self):
        with set_timezone("America/New_York"):
            index = ScheduleIndex("2025-26", GAMES)
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-05"),
                {"001", "002", "003", "004"},
            )
            self.assertEqual(
                index.et_dates_for_local_date("2026-01-05"), ["2026-01-05"]
            )
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-06"), {"005"}
            )

    def test_london_date_can_span_two_et_dates(self):
        with set_timezone("Europe/London"):
            index = ScheduleIndex("2025-26", GAMES)
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-06"),
                {"001", "004", "005"},
            )
            self.assertEqual(
                index.et_dates_for_local_date("2026-01-06"),
                ["2026-01-05", "2026-01-06"],
            )
            self.assertEqual(
                index.game_ids_for_local_date("2026-01-05"),
                {"002", "003"},
            )

    def test_game_metadata_is_preserved(self):
        with set_timezone("Asia/Shanghai"):
            index = ScheduleIndex("2025-26", GAMES)
            self.assertEqual(index.tipoff_utc("004"), "2026-01-06T03:00:00Z")
            self.assertEqual(index.et_date("004"), "2026-01-05")
            self.assertEqual(index.local_date("004"), "2026-01-06")
            self.assertEqual(
                index.by_game_id["004"]["homeTeam"]["teamTricode"], "LAL"
            )

    def test_asian_local_dates_extend_into_next_day(self):
        with set_timezone("Asia/Shanghai"):
            index = ScheduleIndex("2025-26", GAMES)
            self.assertEqual(index.min_local_date, "2026-01-06")
            self.assertEqual(index.max_local_date, "2026-01-07")
            self.assertTrue(index.covers("2026-01-06"))
            self.assertTrue(index.covers("2026-01-07"))
            self.assertFalse(index.covers("2026-01-05"))
            self.assertFalse(index.covers("2026-01-08"))

    def test_malformed_games_are_skipped(self):
        with set_timezone("Asia/Shanghai"):
            index = ScheduleIndex(
                "2025-26",
                [
                    {"gameId": "bad", "gameDateTimeUTC": "not-a-timestamp"},
                    {"gameDateTimeUTC": "2026-01-06T00:30:00Z"},
                    {"gameId": "ok"},
                    GAMES[0],
                ],
            )
            self.assertEqual(set(index.by_game_id), {"001"})


class CacheTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._original_db_path = cache_service.CACHE_DB_PATH
        self._original_schema_checked = cache_service._schema_checked
        cache_service.CACHE_DB_PATH = os.path.join(self._tmp.name, "cache.db")
        cache_service._schema_checked = False
        schedule_service.clear_memory_cache()

    def tearDown(self):
        schedule_service.clear_memory_cache()
        cache_service.CACHE_DB_PATH = self._original_db_path
        cache_service._schema_checked = self._original_schema_checked
        self._tmp.cleanup()


class EmptyScheduleCacheTest(CacheTestCase):
    def test_off_day_is_cached_as_empty_list(self):
        cache_service.cache_schedule("2026-01-05", [])
        self.assertEqual(cache_service.get_cached_schedule("2026-01-05"), [])

    def test_scheduled_past_date_is_treated_as_stale(self):
        cache_service.cache_schedule("2020-01-01", [{"gameStatus": 1}])
        self.assertIsNone(cache_service.get_cached_schedule("2020-01-01"))
        self.assertEqual(
            cache_service.get_cached_schedule_fallback("2020-01-01"),
            [{"gameStatus": 1}],
        )


class CacheTimezoneIsolationTest(CacheTestCase):
    def test_games_cache_is_not_reused_across_timezones(self):
        shanghai_games = [{"gameId": "001", "gameStatus": 3}]
        new_york_games = [{"gameId": "101", "gameStatus": 3}]

        with set_timezone("Asia/Shanghai"):
            cache_service.cache_games("2026-01-05", shanghai_games)
            self.assertEqual(
                cache_service.get_cached_games("2026-01-05"), shanghai_games
            )

        with set_timezone("America/New_York"):
            self.assertIsNone(cache_service.get_cached_games("2026-01-05"))
            cache_service.cache_games("2026-01-05", new_york_games)

        with set_timezone("Asia/Shanghai"):
            self.assertEqual(
                cache_service.get_cached_games("2026-01-05"), shanghai_games
            )

    def test_schedule_cache_is_not_reused_across_timezones(self):
        with set_timezone("Asia/Shanghai"):
            cache_service.cache_schedule("2026-01-06", [])
            self.assertEqual(cache_service.get_cached_schedule("2026-01-06"), [])

        with set_timezone("Europe/London"):
            self.assertIsNone(cache_service.get_cached_schedule("2026-01-06"))


class SchemaVersionTest(CacheTestCase):
    def test_version_bump_clears_derived_caches(self):
        conn = sqlite3.connect(cache_service.CACHE_DB_PATH)
        conn.execute(
            "CREATE TABLE games_cache "
            "(date TEXT PRIMARY KEY, data TEXT NOT NULL, cached_at TEXT NOT NULL)"
        )
        conn.execute(
            "CREATE TABLE cache_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT INTO games_cache VALUES ('2026-01-05', '[]', '2026-01-05T00:00:00')"
        )
        conn.execute("INSERT INTO cache_meta VALUES ('schema_version', '1')")
        conn.commit()
        conn.close()

        self.assertIsNone(cache_service.get_cached_games("2026-01-05"))

        conn = sqlite3.connect(cache_service.CACHE_DB_PATH)
        version = conn.execute(
            "SELECT value FROM cache_meta WHERE key = 'schema_version'"
        ).fetchone()
        count = conn.execute("SELECT COUNT(*) FROM games_cache").fetchone()
        conn.close()

        self.assertEqual(version[0], str(cache_service.CACHE_SCHEMA_VERSION))
        self.assertEqual(count[0], 0)


class GetIndexTest(CacheTestCase):
    def test_index_is_cached_in_memory_and_sqlite(self):
        with set_timezone("Asia/Shanghai"), mock.patch.object(
            schedule_service, "_fetch_schedule", return_value=GAMES
        ) as fetch:
            first = schedule_service.get_index("2025-26")
            self.assertIsNotNone(first)
            self.assertEqual(fetch.call_count, 1)

            # Memory hit.
            second = schedule_service.get_index("2025-26")
            self.assertIs(second, first)
            self.assertEqual(fetch.call_count, 1)

            # SQLite hit after dropping the in-memory index.
            schedule_service.clear_memory_cache()
            third = schedule_service.get_index("2025-26")
            self.assertIsNotNone(third)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(
                third.game_ids_for_local_date("2026-01-06"),
                {"001", "002", "003", "004"},
            )

    def test_failed_fetch_returns_none_and_is_not_cached(self):
        with mock.patch.object(
            schedule_service, "_fetch_schedule", side_effect=RuntimeError("boom")
        ):
            self.assertIsNone(schedule_service.get_index("2025-26"))
            self.assertIsNone(schedule_service.get_index("2025-26"))

    def test_empty_schedule_is_not_cached(self):
        with mock.patch.object(
            schedule_service, "_fetch_schedule", return_value=[]
        ) as fetch:
            self.assertIsNone(schedule_service.get_index("2025-26"))
            self.assertIsNone(schedule_service.get_index("2025-26"))
            self.assertEqual(fetch.call_count, 2)

    def test_get_index_for_date_selects_season(self):
        with set_timezone("Asia/Shanghai"), mock.patch.object(
            schedule_service, "get_index", return_value="sentinel"
        ) as get_index:
            self.assertEqual(
                schedule_service.get_index_for_date("2026-01-05"), "sentinel"
            )
            get_index.assert_called_once_with("2025-26")

    def test_get_index_for_date_handles_invalid_input(self):
        self.assertIsNone(schedule_service.get_index_for_date("nope"))


if __name__ == "__main__":
    unittest.main()
