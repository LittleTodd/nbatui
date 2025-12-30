"""
NBA Games Router
Endpoints for game data from nba_api
"""
from fastapi import APIRouter, HTTPException
from services.nba_service import NBAService

router = APIRouter(prefix="/games", tags=["games"])
nba_service = NBAService()


@router.get("/today")
async def get_today_games():
    """Get all games scheduled for today with current scores"""
    try:
        games = nba_service.get_today_games()
        return {"games": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live")
async def get_live_scores():
    """Get live scores for games currently in progress"""
    try:
        games = nba_service.get_today_games()
        live_games = [g for g in games if g.get("gameStatus") == 2]  # Status 2 = In Progress
        return {"games": live_games, "count": len(live_games)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams")
async def get_all_teams():
    """Get all NBA teams with their info"""
    try:
        teams = nba_service.get_all_teams()
        return {"teams": teams, "count": len(teams)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
