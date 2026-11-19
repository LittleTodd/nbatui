"""Tests for future game schedule retrieval, ScoreboardV3, and fallback."""
import os
import tempfile
import unittest
from unittest import mock

from tests.helpers import set_timezone

from services import cache_service, schedule_service
from services.nba_service import NBAService


SAMPLE_SCHEDULE_GAMES = [
    {
        "gameId": "0022600119",
        "gameDateTimeUTC": "2026-10-26T23:00:00Z",
        "gameStatus": 1,
        "gameStatusText": "7:00 pm ET",
        "homeTeam": {
            "teamId": 1610612766,
            "teamName": "Hornets",
            "teamCity": "Charlotte",
            "teamTricode": "CHA",
        },
        "awayTeam": {
            "teamId": 1610612764,
            "teamName": "Wizards",
            "teamCity": "Washington",
            "teamTricode": "WAS",
        },
    },
    {
        "gameId": "0022600120",
        "gameDateTimeUTC": "2026-10-26T23:00:00Z",
        "gameStatus": 1,
        "gameStatusText": "7:00 pm ET",
        "homeTeam": {
            "teamId": 1610612739,
            "teamName": "Cavaliers",
            "teamCity": "Cleveland",
            "teamTricode": "CLE",
        },
        "awayTeam": {
            "teamId": 1610612750,
            "teamName": "Timberwolves",
            "teamCity": "Minnesota",
            "teamTricode": "MIN",
        },
    },
]


class FutureGamesTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self._original_db_path = cache_service.CACHE_DB_PATH
        self._original_schema_checked = cache_service._schema_checked
        cache_service.CACHE_DB_PATH = os.path.join(self._tmp.name, "cache.db")
        cache_service._schema_checked = False
        schedule_service.clear_memory_cache()
        self.service = NBAService()

    def tearDown(self):
        schedule_service.clear_memory_cache()
        cache_service.CACHE_DB_PATH = self._original_db_path
        cache_service._schema_checked = self._original_schema_checked
        self._tmp.cleanup()

    def test_future_games_fallback_to_schedule_when_stats_api_fails(self):
        """When Stats API fails, games are recovered from season schedule index."""
        with set_timezone("Asia/Shanghai"):
            with mock.patch.object(
                schedule_service, "_fetch_schedule", return_value=SAMPLE_SCHEDULE_GAMES
            ), mock.patch.object(
                self.service, "_fetch_stats_games", side_effect=Exception("API down")
            ):
                games = self.service.get_games_by_date("2026-10-27")
                self.assertEqual(len(games), 2)
                game_ids = {g["gameId"] for g in games}
                self.assertEqual(game_ids, {"0022600119", "0022600120"})
                self.assertEqual(games[0]["gameStatus"], 1)
                self.assertEqual(games[0]["homeTeam"]["score"], 0)
                self.assertEqual(games[0]["awayTeam"]["score"], 0)
                self.assertEqual(games[0]["localDate"], "2026-10-27")

    def test_future_games_cached_in_schedule_cache(self):
        """Scheduled future games are stored in and served from schedule_cache."""
        with set_timezone("Asia/Shanghai"):
            with mock.patch(
                "services.timezone_utils.get_local_today", return_value="2026-10-25"
            ), mock.patch.object(
                schedule_service, "_fetch_schedule", return_value=SAMPLE_SCHEDULE_GAMES
            ), mock.patch.object(
                self.service, "_fetch_stats_games", return_value=[]
            ):
                # First call populates cache
                games = self.service.get_games_by_date("2026-10-27")
                self.assertEqual(len(games), 2)

                # Ensure it was cached in schedule_cache
                cached = cache_service.get_cached_schedule("2026-10-27")
                self.assertIsNotNone(cached)
                self.assertEqual(len(cached), 2)

            # Second call retrieves from cache without touching schedule or stats API
            with mock.patch(
                "services.timezone_utils.get_local_today", return_value="2026-10-25"
            ), mock.patch.object(
                schedule_service, "get_index_for_date", side_effect=AssertionError("Should not be called")
            ):
                cached_games = self.service.get_games_by_date("2026-10-27")
                self.assertEqual(len(cached_games), 2)
                self.assertEqual(cached_games[0]["localDate"], "2026-10-27")

    def test_fetch_stats_games_parses_scoreboard_v3(self):
        """ScoreboardV3 responses are properly mapped to internal game objects."""
        fake_v3_data = {
            "scoreboard": {
                "gameDate": "2026-10-26",
                "games": [
                    {
                        "gameId": "0022600119",
                        "gameStatus": 1,
                        "gameStatusText": "7:00 pm ET",
                        "period": 0,
                        "gameClock": "",
                        "gameTimeUTC": "2026-10-26T23:00:00Z",
                        "homeTeam": {
                            "teamId": 1610612766,
                            "teamName": "Hornets",
                            "teamCity": "Charlotte",
                            "teamTricode": "CHA",
                            "score": 0,
                        },
                        "awayTeam": {
                            "teamId": 1610612764,
                            "teamName": "Wizards",
                            "teamCity": "Washington",
                            "teamTricode": "WAS",
                            "score": 0,
                        },
                    }
                ],
            }
        }

        mock_board = mock.MagicMock()
        mock_board.get_dict.return_value = fake_v3_data

        with mock.patch("services.timezone_utils.utc_to_et_date", return_value="2026-10-20"), \
             mock.patch("nba_api.stats.endpoints.scoreboardv3.ScoreboardV3", return_value=mock_board):
            games = self.service._fetch_stats_games("2026-10-26")
            self.assertEqual(len(games), 1)
            self.assertEqual(games[0]["gameId"], "0022600119")
            self.assertEqual(games[0]["gameStatus"], 1)
            self.assertEqual(games[0]["gameStatusText"], "7:00 pm ET")
            self.assertEqual(games[0]["homeTeam"]["teamTricode"], "CHA")
            self.assertEqual(games[0]["awayTeam"]["teamTricode"], "WAS")


if __name__ == "__main__":
    unittest.main()
