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
def get_game_playbyplay(game_id: str, status: int = None):
    """
    Get play-by-play data for a specific game.
    Pass status=3 to enable caching for completed games.
    """
    try:
        data = nba_service.get_playbyplay(game_id, game_status=status)
        if not data:
            raise HTTPException(status_code=404, detail="Game not found or no data available")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{game_id}/score-curve")
def get_game_score_curve(game_id: str):
    """
    Get simplified scoring progression for charting.
    Returns an array of points: { time, homeScore, awayScore }
    Sampled to ~50 points for efficient rendering.
    """
    try:
        data = nba_service.get_playbyplay(game_id)
        if not data:
            raise HTTPException(status_code=404, detail="Game not found or no data available")
        
        actions = data.get('actions', [])
        if not actions:
            return {"points": [], "homeTeam": "", "awayTeam": ""}
        
        # Extract scoring events (when score changes)
        points = []
        last_home = "0"
        last_away = "0"
        
        for action in actions:
            home = action.get('scoreHome', '0') or '0'
            away = action.get('scoreAway', '0') or '0'
            
            # Only add when score changes
            if home != last_home or away != last_away:
                period = action.get('period', 1)
                clock = action.get('clock', 'PT12M00.00S')
                
                # Parse clock to get minutes remaining
                try:
                    minutes = float(clock.replace('PT', '').split('M')[0])
                except:
                    minutes = 12.0
                
                # Calculate progress (0-100) across all periods
                # Q1: 0-25, Q2: 25-50, Q3: 50-75, Q4: 75-100
                period_progress = (12 - minutes) / 12
                overall_progress = ((period - 1) * 25) + (period_progress * 25)
                
                points.append({
                    "time": round(overall_progress, 1),
                    "homeScore": int(home),
                    "awayScore": int(away),
                    "period": period
                })
                
                last_home = home
                last_away = away
        
        # Sample to max 50 points for performance
        if len(points) > 50:
            step = len(points) // 50
            points = points[::step] + [points[-1]]  # Always include final score
        
        return {
            "points": points,
            "homeTeam": data.get('homeTeam', {}).get('teamTricode', ''),
            "awayTeam": data.get('awayTeam', {}).get('teamTricode', '')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




