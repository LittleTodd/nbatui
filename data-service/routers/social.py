"""
Social Media Router
Endpoints for Reddit heat and comments (Phase 2)
"""
from fastapi import APIRouter, HTTPException
from services.reddit_service import RedditService
from typing import Any
import time

router = APIRouter(prefix="/social", tags=["social"])
reddit_service = RedditService()

# Simple in-memory cache to avoid hitting Reddit too hard
# Key: {game_key}_{type} -> {data: ..., timestamp: ...}
_cache = {}
CACHE_TTL = 300  # 5 minutes

def get_from_cache(key: str):
    if key in _cache:
        item = _cache[key]
        if time.time() - item['timestamp'] < CACHE_TTL:
            return item['data']
    return None

def set_cache(key: str, data: Any):
    _cache[key] = {
        'data': data,
        'timestamp': time.time()
    }

@router.get("/heat/{team1}/{team2}")
def get_game_heat(team1: str, team2: str):
    """
    Get social media discussion heat (Reddit Comment Count)
    """
    cache_key = f"heat_{team1}_{team2}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    # 1. Search for thread
    thread = reddit_service.find_game_thread(team1, team2)
    
    if not thread:
        # Fallback response for "Cold"
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
        "school_thread_id": thread['id'], # Internal debugging
        "url": thread['url']
    }
    
    set_cache(cache_key, result)
    return result


@router.get("/tweets/{team1}/{team2}")
def get_game_tweets(team1: str, team2: str, limit: int = 5):
    """
    Get top comments from Reddit Game Thread
    """
    cache_key = f"comments_{team1}_{team2}_{limit}"
    cached = get_from_cache(cache_key)
    if cached:
        return cached

    # 1. We need the thread ID first
    thread = reddit_service.find_game_thread(team1, team2)
    if not thread:
        return {"tweets": []}
        
    # 2. Fetch comments
    comments = reddit_service.get_top_comments(thread['id'], limit=limit)
    
    # Format for frontend (mimic tweet structure)
    formatted_comments = []
    for c in comments:
        formatted_comments.append({
            "text": c['body'],
            "user": f"u/{c['author']}",
            "likes": c['score'],
            "id": c['id']
        })
        
    result = {"tweets": formatted_comments}
    set_cache(cache_key, result)
    return result
