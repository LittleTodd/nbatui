"""
Polymarket Odds Router
API endpoints for fetching prediction market odds
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Optional

from services.polymarket_service import fetch_polymarket_odds, get_odds_for_game

router = APIRouter(prefix="/api/polymarket", tags=["polymarket"])


@router.get("/odds")
def get_all_odds() -> Dict:
    """
    Get all available NBA game odds from Polymarket.
    Returns a dict keyed by "AWAY_HOME_DATE".
    """
    odds = fetch_polymarket_odds()
    return {"odds": odds, "count": len(odds)}


@router.get("/odds/{away_team}/{home_team}/{game_date}")
def get_game_odds(away_team: str, home_team: str, game_date: str) -> Dict:
    """
    Get odds for a specific game.
    
    - away_team: Away team tricode (e.g., "DET")
    - home_team: Home team tricode (e.g., "LAL")
    - game_date: Game date in YYYY-MM-DD format
    """
    odds = get_odds_for_game(away_team.upper(), home_team.upper(), game_date)
    
    if not odds:
        return {"odds": None, "found": False}
    
    return {"odds": odds, "found": True}


@router.get("/props")
def get_nba_props() -> Dict:
    """
    Get generic NBA props (Championship, MVP, ROY, etc.)
    """
    from services.polymarket_service import fetch_nba_props
    props = fetch_nba_props()
    return {"props": props}


@router.get("/history/{clob_id}")
def get_token_history(clob_id: str) -> Dict:
    """
    Get 24h price history for a specific CLOB token ID.
    """
    from services.polymarket_service import fetch_market_history
    history = fetch_market_history(clob_id)
    return {"history": history, "count": len(history)}
