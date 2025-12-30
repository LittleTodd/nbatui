"""
Social Media Router
Endpoints for Twitter/X heat and tweets (placeholder for Phase 2)
"""
from fastapi import APIRouter

router = APIRouter(prefix="/social", tags=["social"])


@router.get("/heat/{team1}/{team2}")
async def get_game_heat(team1: str, team2: str):
    """
    Get social media discussion heat for a game matchup
    Returns tweet count and heat level
    
    Heat levels:
    - cold: 0-10 tweets
    - normal: 11-50 tweets  
    - hot: 51-200 tweets
    - fire: 200+ tweets
    """
    # TODO: Implement snscrape integration in Phase 2
    return {
        "team1": team1,
        "team2": team2,
        "count": 0,
        "level": "cold",
        "trending": False,
        "message": "Social features coming in Phase 2"
    }


@router.get("/tweets/{team1}/{team2}")
async def get_game_tweets(team1: str, team2: str, limit: int = 5):
    """
    Get top tweets about a game matchup
    Filters for humor and engagement
    """
    # TODO: Implement snscrape integration in Phase 2
    return {
        "team1": team1,
        "team2": team2,
        "tweets": [],
        "message": "Social features coming in Phase 2"
    }
