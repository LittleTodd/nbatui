"""
Cache Service
SQLite-based caching for completed NBA game data
"""
import sqlite3
import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

# Cache database path
CACHE_DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'cache.db')


def _get_connection() -> sqlite3.Connection:
    """Get SQLite connection and ensure tables exist"""
    conn = sqlite3.connect(CACHE_DB_PATH)
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
    conn.commit()
    return conn


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
            (date, json.dumps(games), datetime.now().isoformat())
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
            (date,)
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

SCHEDULE_CACHE_TTL_HOURS = 24  # Refresh schedule cache every 24 hours


def cache_schedule(date: str, games: List[Dict[str, Any]]) -> None:
    """
    Cache future game schedule for a date.
    Stores matchup info without requiring all games to be completed.
    """
    if not games:
        return
    
    try:
        conn = _get_connection()
        conn.execute(
            'INSERT OR REPLACE INTO schedule_cache (date, data, cached_at) VALUES (?, ?, ?)',
            (date, json.dumps(games), datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def get_cached_schedule(date: str) -> Optional[List[Dict[str, Any]]]:
    """
    Get cached schedule for a future date.
    Returns None if not cached or if cache is stale (>24h old).
    """
    try:
        conn = _get_connection()
        cursor = conn.execute(
            'SELECT data, cached_at FROM schedule_cache WHERE date = ?',
            (date,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if row:
            cached_at = datetime.fromisoformat(row[1])
            # Check if cache is stale
            if datetime.now() - cached_at > timedelta(hours=SCHEDULE_CACHE_TTL_HOURS):
                return None  # Cache expired, need fresh data
            return json.loads(row[0])
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
            (date,)
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
