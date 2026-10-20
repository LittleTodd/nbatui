"""
Season Schedule Index
---------------------
Maps the user's *local* calendar date to exact NBA game IDs using the official
season schedule (``ScheduleLeagueV2``), which includes real UTC tip-off times.

Why this exists
---------------
The NBA calendar is based on US Eastern Time. A 7:00 PM ET game on Jan 5 is
Jan 6 in Asia and still Jan 5 in the US. Deriving the NBA date with a hardcoded
``local_date - 1`` works in Asia but is wrong in the US and partially wrong in
Europe. The schedule index removes the guesswork: every game has a UTC tip-off
time, so its local date can be computed exactly.

The index is cached in memory and in SQLite. If the schedule endpoint is
unavailable, callers fall back to :func:`timezone_utils.nba_date_candidates`.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set

from . import cache_service
from .timezone_utils import utc_to_et_date, utc_to_local_date

SCHEDULE_TTL_HOURS = 12
_CACHE_KEY_PREFIX = "season_schedule_v1_"

_LOCK = threading.Lock()
_MEMORY: Dict[str, Any] = {"season": None, "built_at": 0.0, "index": None}


def season_for_date(date_str: str) -> str:
    """
    Return the NBA season string (e.g. ``2025-26``) that contains ``date_str``.

    The NBA season starts in October. A July date belongs to the season that
    started the previous October.
    """
    day = datetime.strptime(date_str, "%Y-%m-%d")
    start_year = day.year if day.month >= 10 else day.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _slim_game(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Keep only the fields needed to build the index."""
    game_id = raw.get("gameId")
    tipoff = raw.get("gameDateTimeUTC")
    if not game_id or not tipoff:
        return None

    home = raw.get("homeTeam") or {}
    away = raw.get("awayTeam") or {}

    return {
        "gameId": game_id,
        "gameDateTimeUTC": tipoff,
        "gameStatus": raw.get("gameStatus"),
        "gameStatusText": raw.get("gameStatusText"),
        "homeTeam": {
            "teamId": home.get("teamId"),
            "teamName": home.get("teamName"),
            "teamCity": home.get("teamCity"),
            "teamTricode": home.get("teamTricode"),
        },
        "awayTeam": {
            "teamId": away.get("teamId"),
            "teamName": away.get("teamName"),
            "teamCity": away.get("teamCity"),
            "teamTricode": away.get("teamTricode"),
        },
    }


def _fetch_schedule(season: str) -> List[Dict[str, Any]]:
    """Fetch and slim the official season schedule."""
    from nba_api.stats.endpoints import scheduleleaguev2

    data = scheduleleaguev2.ScheduleLeagueV2(season=season, timeout=30).get_dict()
    game_dates = (data.get("leagueSchedule") or {}).get("gameDates") or []

    games: List[Dict[str, Any]] = []
    for game_date in game_dates:
        for raw in game_date.get("games") or []:
            slim = _slim_game(raw)
            if slim is not None:
                games.append(slim)
    return games


class ScheduleIndex:
    """Exact local-date / ET-date index for a single season."""

    def __init__(self, season: str, games: Iterable[Dict[str, Any]]):
        self.season = season
        self.by_game_id: Dict[str, Dict[str, Any]] = {}
        self.by_local_date: Dict[str, Set[str]] = {}
        self.by_et_date: Dict[str, Set[str]] = {}
        self.min_local_date: Optional[str] = None
        self.max_local_date: Optional[str] = None

        for game in games:
            game_id = game.get("gameId")
            tipoff = game.get("gameDateTimeUTC")
            if not game_id or not tipoff:
                continue

            try:
                local_date = utc_to_local_date(tipoff)
                et_date = utc_to_et_date(tipoff)
            except (ValueError, TypeError):
                continue

            # Prefer the NBA-provided team data, but allow callers to pass a
            # minimal {gameId, gameDateTimeUTC} record in tests.
            entry = dict(game)
            entry["localDate"] = local_date
            entry["etDate"] = et_date
            self.by_game_id[game_id] = entry
            self.by_local_date.setdefault(local_date, set()).add(game_id)
            self.by_et_date.setdefault(et_date, set()).add(game_id)

            if self.min_local_date is None or local_date < self.min_local_date:
                self.min_local_date = local_date
            if self.max_local_date is None or local_date > self.max_local_date:
                self.max_local_date = local_date

    def covers(self, local_date: str) -> bool:
        """Whether the official schedule covers this local date."""
        if self.min_local_date is None or self.max_local_date is None:
            return False
        return self.min_local_date <= local_date <= self.max_local_date

    def game_ids_for_local_date(self, local_date: str) -> Set[str]:
        """Game IDs that tip off on ``local_date`` in the user's timezone."""
        return set(self.by_local_date.get(local_date, set()))

    def et_dates_for_local_date(self, local_date: str) -> List[str]:
        """NBA/ET dates that need to be queried for ``local_date``."""
        game_ids = self.by_local_date.get(local_date, set())
        et_dates = {
            self.by_game_id[game_id]["etDate"]
            for game_id in game_ids
            if game_id in self.by_game_id
        }
        return sorted(et_dates)

    def tipoff_utc(self, game_id: str) -> Optional[str]:
        entry = self.by_game_id.get(game_id)
        return entry.get("gameDateTimeUTC") if entry else None

    def et_date(self, game_id: str) -> Optional[str]:
        entry = self.by_game_id.get(game_id)
        return entry.get("etDate") if entry else None

    def local_date(self, game_id: str) -> Optional[str]:
        entry = self.by_game_id.get(game_id)
        return entry.get("localDate") if entry else None


def _build_index(season: str, games: List[Dict[str, Any]]) -> ScheduleIndex:
    return ScheduleIndex(season, games)


def get_index(season: str) -> Optional[ScheduleIndex]:
    """
    Get the schedule index for ``season``, fetching it if needed.

    Returns None when the schedule endpoint is unavailable. Callers should then
    use the timezone heuristic fallback.
    """
    global _MEMORY

    with _LOCK:
        cached = _MEMORY.get("index")
        if (
            cached is not None
            and _MEMORY.get("season") == season
            and time.monotonic() - float(_MEMORY.get("built_at") or 0.0)
            < SCHEDULE_TTL_HOURS * 3600
        ):
            return cached  # type: ignore[return-value]

        cache_key = f"{_CACHE_KEY_PREFIX}{season}"

        stored = cache_service.get_cached_by_key(cache_key, ttl_hours=SCHEDULE_TTL_HOURS)
        if stored and isinstance(stored.get("games"), list):
            index = _build_index(season, stored["games"])
            _MEMORY = {"season": season, "built_at": time.monotonic(), "index": index}
            return index

        try:
            games = _fetch_schedule(season)
        except Exception as error:
            print(f"[Schedule] Failed to fetch {season} schedule: {error}", flush=True)
            return None

        if not games:
            return None

        cache_service.cache_by_key(
            cache_key,
            {"games": games},
            ttl_hours=SCHEDULE_TTL_HOURS,
        )
        index = _build_index(season, games)
        _MEMORY = {"season": season, "built_at": time.monotonic(), "index": index}
        return index


def get_index_for_date(date_str: str) -> Optional[ScheduleIndex]:
    """Get the schedule index for the season containing ``date_str``."""
    try:
        return get_index(season_for_date(date_str))
    except (ValueError, TypeError):
        return None


def clear_memory_cache() -> None:
    """Drop the in-memory index (used by tests)."""
    global _MEMORY
    with _LOCK:
        _MEMORY = {"season": None, "built_at": 0.0, "index": None}


__all__ = [
    "ScheduleIndex",
    "clear_memory_cache",
    "get_index",
    "get_index_for_date",
    "season_for_date",
]
