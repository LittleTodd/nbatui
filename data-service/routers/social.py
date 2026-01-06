"""
Social Media Router
Endpoints for Reddit heat and comments (Phase 2)
"""
from fastapi import APIRouter, HTTPException, Query
from services.reddit_service import RedditService
from services import cache_service
from typing import Any, Optional
import time
from datetime import datetime, timedelta

router = APIRouter(prefix="/social", tags=["social"])
reddit_service = RedditService()

# Simple in-memory cache for Live/Scheduled games (short term)
# Key: {game_key}_{type} -> {data: ..., timestamp: ...}
_mem_cache = {}
CACHE_TTL = 300  # 5 minutes
PERMANENT_CACHE_DELAY_HOURS = 2  # Wait 2 hours after game ends before permanent cache

def get_from_mem_cache(key: str):
    if key in _mem_cache:
        item = _mem_cache[key]
        if time.time() - item['timestamp'] < CACHE_TTL:
            return item['data']
    return None

def set_mem_cache(key: str, data: Any):
    _mem_cache[key] = {
        'data': data,
        'timestamp': time.time()
    }

@router.get("/heat/{team1}/{team2}")
def get_game_heat(
    team1: str, 
    team2: str, 
    status: Optional[int] = Query(None), 
    date: Optional[str] = Query(None),
    game_id: Optional[str] = Query(None)
):
    """
    Get social media heat.
    - If game is FINAL (status=3) and 2+ hours have passed, use persistent cache.
    - Else use in-memory cache.
    """
    # 1. Check Persistent Cache for Final Games
    db_key = f"heat_{team1}_{team2}_{date}"
    if status == 3 and date:
        cached = cache_service.get_cached_social(db_key)
        if cached:
            return cached

    # 1b. Skip Reddit for Scheduled games - no Game Thread exists yet
    if status == 1:
        return {"count": 0, "level": "cold", "trending": False, "message": "Game not started"}

    # 2. Check Memory Cache (for all games)
    mem_key = f"heat_{team1}_{team2}"
    cached = get_from_mem_cache(mem_key)
    if cached:
        return cached

    # 3. Check for old games (No fetch if > 6 months)
    # Note: Frontend should usually block this, but safety check here
    if date:
        try:
            # Use timezone_utils to handle local dates correctly
            from services.timezone_utils import convert_utc_to_local_date, get_local_today
            game_date = datetime.strptime(date, "%Y-%m-%d")
            if datetime.now() - game_date > timedelta(days=180):
                 return {"count": 0, "level": "cold", "trending": False, "message": "Archived"}
        except:
            pass

    # 4. Search Reddit
    thread = reddit_service.find_game_thread(team1, team2)
    
    if not thread:
        return {
            "count": 0,
            "level": "cold",
            "trending": False,
            "message": "No active thread found"
        }
    
    count = thread['num_comments']
    
    # Heat logic
    level = "cold"
    if count > 1000:
        level = "fire"
    elif count > 200:
        level = "hot"
    elif count > 50:
        level = "warm"
        
    result = {
        "count": count,
        "level": level,
        "trending": count > 500,
        "school_thread_id": thread['id'],
        "url": thread['url']
    }
    
    # 5. Save to memory cache only (permanent caching handled by Worker)
    set_mem_cache(mem_key, result)
    
    # Record game end time for Worker to use later
    if status == 3 and game_id:
        cache_service.record_game_end_time(game_id)

    return result


@router.get("/tweets/{team1}/{team2}")
def get_game_tweets(
    team1: str, 
    team2: str, 
    limit: int = 5,
    status: Optional[int] = Query(None),
    date: Optional[str] = Query(None),
    game_id: Optional[str] = Query(None)
):
    """
    Get top comments.
    """
    # 1. Check Persistent Cache
    db_key = f"comments_{team1}_{team2}_{date}_{limit}"
    if status == 3 and date:
        cached = cache_service.get_cached_social(db_key)
        if cached:
            return cached

    # 1b. Skip Reddit for Scheduled games - no Game Thread exists yet
    if status == 1:
        return {"tweets": []}

    # 2. Check Memory Cache
    mem_key = f"comments_{team1}_{team2}_{limit}"
    cached = get_from_mem_cache(mem_key)
    if cached:
        return cached
        
    # 3. Old Game Check
    if date:
        try:
            from services.timezone_utils import convert_utc_to_local_date
            game_date = datetime.strptime(date, "%Y-%m-%d")
            if datetime.now() - game_date > timedelta(days=180):
                 return {"tweets": []}
        except:
            pass

    # 4. Fetch
    thread = reddit_service.find_game_thread(team1, team2)
    if not thread:
        return {"tweets": []}
        
    comments = reddit_service.get_top_comments(thread['id'], limit=limit)
    
    formatted_comments = []
    for c in comments:
        formatted_comments.append({
            "text": c['body'],
            "user": f"u/{c['author']}",
            "likes": c['score'],
            "id": c['id']
        })
        
    result = {"tweets": formatted_comments}
    
    # 5. Save to memory cache only (permanent caching handled by Worker)
    set_mem_cache(mem_key, result)
    
    # Record game end time for Worker to use later
    if status == 3 and game_id:
        cache_service.record_game_end_time(game_id)
        
    return result
