"""
NBA Games Router
Endpoints for game data from nba_api
"""
from fastapi import APIRouter, HTTPException
from services.nba_service import NBAService

router = APIRouter(prefix="/games", tags=["games"])
nba_service = NBAService()


@router.get("/today")
def get_today_games():
    """Get all games scheduled for today with current scores"""
    try:
        games = nba_service.get_today_games()
        return {"games": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/date/{date_str}")
def get_games_by_date_endpoint(date_str: str):
    """Get games for a specific date (YYYY-MM-DD)"""
    try:
        games = nba_service.get_games_by_date(date_str)
        return {"games": games, "count": len(games)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live")
def get_live_scores():
    """Get live scores for games currently in progress"""
    try:
        games = nba_service.get_today_games()
        live_games = [g for g in games if g.get("gameStatus") == 2]  # Status 2 = In Progress
        return {"games": live_games, "count": len(live_games)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/teams")
def get_all_teams():
    """Get all NBA teams with their info"""
    try:
        teams = nba_service.get_all_teams()
        return {"teams": teams, "count": len(teams)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/standings")
def get_standings():
    """Get current league standings"""
    try:
        data = nba_service.get_standings()
        return {"standings": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/boxscore")
def get_game_boxscore(game_id: str):
    """Get boxscore data for a specific game"""
    try:
        data = nba_service.get_boxscore(game_id)
        if not data:
            raise HTTPException(status_code=404, detail="Game not found or no data available")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/playbyplay")
def get_game_playbyplay(game_id: str):
    """Get play-by-play data for a specific game"""
    try:
        data = nba_service.get_playbyplay(game_id)
        if not data:
            raise HTTPException(status_code=404, detail="Game not found or no data available")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
