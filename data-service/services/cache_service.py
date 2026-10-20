"""
Cache Service
SQLite-based caching for completed NBA game data
"""
import sqlite3
import json
import os
import threading
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

# Cache database path
CACHE_DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'cache.db')

# Bump this whenever a cache's key semantics change. Old derived caches
# (games/schedule) are cleared once on the next connection.
CACHE_SCHEMA_VERSION = 3

_schema_lock = threading.Lock()
_schema_checked = False


def _local_offset_suffix(date: str) -> str:
    """
    UTC offset for the user's timezone at noon on ``date``, e.g. ``+08:00``.

    Game results depend on the user's timezone (a 7 PM ET game belongs to the
    next local day in Asia), so the same date string can map to different games
    in different timezones. Including the offset keeps cached days from leaking
    across timezones while remaining transparent to callers.
    """
    try:
        offset = (
            datetime.strptime(date, "%Y-%m-%d")
            .replace(hour=12)
            .astimezone()
            .utcoffset()
        )
    except (ValueError, TypeError):
        return ""

    if offset is None:
        return ""

    total_minutes = int(offset.total_seconds() // 60)
    sign = "+" if total_minutes >= 0 else "-"
    hours, minutes = divmod(abs(total_minutes), 60)
    return f"{sign}{hours:02d}:{minutes:02d}"


def _date_cache_key(date: str) -> str:
    """Timezone-aware key for games/schedule caches."""
    suffix = _local_offset_suffix(date)
    return f"{date}|{suffix}" if suffix else date


def _get_connection() -> sqlite3.Connection:
    """Get a SQLite connection and ensure tables exist."""
    conn = sqlite3.connect(CACHE_DB_PATH, timeout=10)

    # WAL keeps the background social worker from blocking request threads.
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
    except sqlite3.DatabaseError:
        # Caching is best-effort; never fail a request because of a pragma.
        pass

    conn.execute('''
        CREATE TABLE IF NOT EXISTS games_cache (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS boxscore_cache (
            game_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS social_cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS game_end_times (
            game_id TEXT PRIMARY KEY,
            end_time TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS schedule_cache (
            date TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS playbyplay_cache (
            game_id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS standings_cache (
            id TEXT PRIMARY KEY DEFAULT 'current',
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS generic_cache (
            key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS cache_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    _ensure_schema_version(conn)

    conn.commit()
    return conn


def _ensure_schema_version(conn: sqlite3.Connection) -> None:
    """
    Clear derived caches once when key semantics change.

    Version 2 changed games/schedule cache keys from the NBA/ET date to the
    user's local date. Version 3 added the local UTC offset to those keys so a
    cache written in one timezone is never reused in another. Reusing old rows
    would show the wrong day's games, so they are dropped on the first
    connection after an upgrade.
    """
    global _schema_checked

    if _schema_checked:
        return

    with _schema_lock:
        if _schema_checked:
            return

        row = conn.execute(
            "SELECT value FROM cache_meta WHERE key = 'schema_version'"
        ).fetchone()
        current = row[0] if row else None

        if current != str(CACHE_SCHEMA_VERSION):
            conn.execute("DELETE FROM games_cache")
            conn.execute("DELETE FROM schedule_cache")
            conn.execute(
                "INSERT OR REPLACE INTO cache_meta (key, value) VALUES ('schema_version', ?)",
                (str(CACHE_SCHEMA_VERSION),),
            )

        conn.commit()
        _schema_checked = True


def cache_games(date: str, games: List[Dict[str, Any]]) -> None:
    """
    Cache games for a specific date.
    Only cache if ALL games are completed (gameStatus=3).
    
    Args:
        date: Date string YYYY-MM-DD
        games: List of game dictionaries
    """
    # Only cache if all games are completed
    if not games:
        return
    
    all_completed = all(g.get('gameStatus') == 3 for g in games)
    if not all_completed:
        return
    
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO games_cache (date, data, cached_at) VALUES (?, ?, ?)',
            (_date_cache_key(date), json.dumps(games), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # Silently fail


def get_cached_games(date: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached games for a date.
    
    Args:
        date: Date string YYYY-MM-DD
        
    Returns:
        List of games if cached, None otherwise
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM games_cache WHERE date = ?',
            (_date_cache_key(date),)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


def cache_boxscore(game_id: str, data: Dict[str, Any]) -> None:
    """
    Cache boxscore for a completed game.
    
    Args:
        game_id: NBA game ID
        data: Boxscore data dictionary
    """
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO boxscore_cache (game_id, data, cached_at) VALUES (?, ?, ?)',
            (game_id, json.dumps(data), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # Silently fail


def get_cached_boxscore(game_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cached boxscore for a game.
    
    Args:
        game_id: NBA game ID
        
    Returns:
        Boxscore data if cached, None otherwise
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM boxscore_cache WHERE game_id = ?',
            (game_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


def cache_social(key: str, data: Dict[str, Any]) -> None:
    """
    Cache social data (tweets/heat) persistently.
    
    Args:
        key: Unique key (e.g., heat_LAL_BOS_2023-12-25)
        data: Social data dictionary
    """
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO social_cache (key, data, cached_at) VALUES (?, ?, ?)',
            (key, json.dumps(data), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_cached_social(key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached social data.
    
    Args:
        key: Unique key
        
    Returns:
        Data if cached, None otherwise
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM social_cache WHERE key = ?',
            (key,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


def get_cache_stats() -> Dict[str, int]:
    """Get cache statistics"""
    try:
        conn = _get_connection()
        games_count = conn.execute('SELECT COUNT(*) FROM games_cache').fetchone()[0]
        boxscore_count = conn.execute('SELECT COUNT(*) FROM boxscore_cache').fetchone()[0]
        social_count = conn.execute('SELECT COUNT(*) FROM social_cache').fetchone()[0]
        playbyplay_count = conn.execute('SELECT COUNT(*) FROM playbyplay_cache').fetchone()[0]
        conn.close()
        return {
            "cached_dates": games_count,
            "cached_boxscores": boxscore_count,
            "cached_social": social_count,
            "cached_playbyplay": playbyplay_count
        }
    except Exception:
        return {"cached_dates": 0, "cached_boxscores": 0}


def cache_playbyplay(game_id: str, data: Dict[str, Any]) -> None:
    """
    Cache play-by-play data for a completed game.
    
    Args:
        game_id: NBA game ID
        data: Play-by-play data dictionary
    """
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO playbyplay_cache (game_id, data, cached_at) VALUES (?, ?, ?)',
            (game_id, json.dumps(data), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # Silently fail


def get_cached_playbyplay(game_id: str) -> Optional[Dict[str, Any]]:
    """
    Get cached play-by-play for a game.
    
    Args:
        game_id: NBA game ID
        
    Returns:
        Play-by-play data if cached, None otherwise
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM playbyplay_cache WHERE game_id = ?',
            (game_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


def record_game_end_time(game_id: str) -> None:
    """
    Record the time when a game transitions to status=3 (Final).
    Only records if not already recorded.
    """
    try:
        conn = _get_connection()
        # Only insert if not exists
        cursor = conn.execute(
            'SELECT end_time FROM game_end_times WHERE game_id = ?',
            (game_id,)
        )
        if cursor.fetchone() is None:
            conn.execute(
                'INSERT INTO game_end_times (game_id, end_time) VALUES (?, ?)',
                (game_id, datetime.now().isoformat())
            )
            conn.commit()
        conn.close()
    except Exception:
        pass


def get_game_end_time(game_id: str) -> Optional[datetime]:
    """
    Get the recorded end time for a game.
    Returns None if not recorded.
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT end_time FROM game_end_times WHERE game_id = ?',
            (game_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return datetime.fromisoformat(row[0])
        return None
    except Exception:
        return None


# ==================== SCHEDULE CACHE (Future Games) ====================

SCHEDULE_CACHE_TTL_HOURS = 48  # Refresh schedule cache every 48 hours


def cache_schedule(date: str, games: List[Dict[str, Any]]) -> None:
    """
    Cache a day's schedule (or an intentional off-day with ``games=[]``).
    Stores matchup info without requiring all games to be completed.
    """
    if games is None:
        return
    
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO schedule_cache (date, data, cached_at) VALUES (?, ?, ?)',
            (_date_cache_key(date), json.dumps(games), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_cached_schedule(date: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached schedule for a future date.
    Returns None if not cached or if cache is stale (>24h old).
    Also returns None if it's a past date with only scheduled games (stale data).
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data, cached_at FROM schedule_cache WHERE date = ?',
            (_date_cache_key(date),)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            cached_at = datetime.fromisoformat(row[1])
            # Check if cache is stale by TTL
            if datetime.now() - cached_at > timedelta(hours=SCHEDULE_CACHE_TTL_HOURS):
                return None  # Cache expired, need fresh data
            
            games = json.loads(row[0])
            
            # Check for stale scheduled data: past date with all games still "scheduled"
            from .timezone_utils import get_local_today
            local_today = get_local_today()
            if date < local_today:
                # Past date - check if games are still showing as scheduled (stale)
                all_scheduled = all(g.get('gameStatus') == 1 for g in games)
                if all_scheduled and games:
                    return None  # Stale cache - games should be completed by now
            
            return games
        return None
    except Exception:
        return None


def is_schedule_cached(date: str) -> bool:
    """
    Check if a date has valid (non-stale) schedule cache.
    """
    return get_cached_schedule(date) is not None


def get_cached_schedule_fallback(date: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached schedule even if stale.
    Used as fallback when NBA API fails.
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM schedule_cache WHERE date = ?',
            (_date_cache_key(date),)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


# ==================== STANDINGS CACHE ====================

STANDINGS_CACHE_TTL_HOURS = 6  # Refresh standings cache every 6 hours


def cache_standings(data: List[Dict[str, Any]]) -> None:
    """
    Cache league standings data.
    
    Args:
        data: List of team standings dictionaries
    """
    if not data:
        return
    
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO standings_cache (id, data, cached_at) VALUES (?, ?, ?)',
            ('current', json.dumps(data), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_cached_standings() -> Optional[List[Dict[str, Any]]]:
    """
    Get cached standings data.
    Returns None if not cached or if cache is stale (>6h old).
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data, cached_at FROM standings_cache WHERE id = ?',
            ('current',)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            cached_at = datetime.fromisoformat(row[1])
            # Check if cache is stale
            if datetime.now() - cached_at > timedelta(hours=STANDINGS_CACHE_TTL_HOURS):
                return None  # Cache expired, need fresh data
            return json.loads(row[0])
        return None
    except Exception:
        return None


def get_cached_standings_fallback() -> Optional[List[Dict[str, Any]]]:
    """
    Get cached standings data even if stale.
    Used as fallback when live API fails.
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data FROM standings_cache WHERE id = ?',
            ('current',)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception:
        return None


# ==================== GENERIC KEY-VALUE CACHE ====================

def cache_by_key(key: str, data: Dict[str, Any], ttl_hours: int = 24) -> None:
    """
    Cache arbitrary data by key.
    
    Args:
        key: Unique cache key
        data: Data dictionary to cache
        ttl_hours: Time-to-live in hours (stored for reference, checked on read)
    """
    if not data:
        return
    
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO generic_cache (key, data, cached_at) VALUES (?, ?, ?)',
            (key, json.dumps(data), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_cached_by_key(key: str, ttl_hours: int = 24) -> Optional[Dict[str, Any]]:
    """
    Get cached data by key with TTL check.
    
    Args:
        key: Cache key
        ttl_hours: Maximum age of cache in hours
        
    Returns:
        Data if cached and not expired, None otherwise
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data, cached_at FROM generic_cache WHERE key = ?',
            (key,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            cached_at = datetime.fromisoformat(row[1])
            # Check if cache is stale
            if datetime.now() - cached_at > timedelta(hours=ttl_hours):
                return None  # Cache expired
            return json.loads(row[0])
        return None
    except Exception:
        return None
