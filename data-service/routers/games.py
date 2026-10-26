"""
NBA Games Router
Endpoints for game data from nba_api
"""
from datetime import datetime

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
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
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
    except HTTPException:
        raise
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_clock_seconds(clock: str, period: int) -> float:
    """Parse ISO duration clock string (e.g. PT12M00.00S, PT45.20S) to remaining seconds."""
    default_seconds = 300.0 if period > 4 else 720.0
    if not clock or not isinstance(clock, str):
        return default_seconds
    try:
        raw = clock.replace('PT', '').strip()
        minutes = 0.0
        seconds = 0.0
        if 'M' in raw:
            parts = raw.split('M')
            minutes = float(parts[0])
            sec_part = parts[1].replace('S', '')
            seconds = float(sec_part) if sec_part else 0.0
        elif 'S' in raw:
            seconds = float(raw.replace('S', ''))
        else:
            return default_seconds
        return max(0.0, minutes * 60.0 + seconds)
    except (ValueError, IndexError, TypeError):
        return default_seconds


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

        # Determine total game duration to scale progress smoothly to 0-100% even with OT (BUG-15)
        max_period = max(4, max((action.get('period', 1) for action in actions), default=4))
        total_seconds = (4 * 720.0) + (max_period - 4) * 300.0

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
                rem_seconds = _parse_clock_seconds(clock, period)

                if period <= 4:
                    elapsed = ((period - 1) * 720.0) + max(0.0, 720.0 - rem_seconds)
                else:
                    elapsed = (4 * 720.0) + ((period - 5) * 300.0) + max(0.0, 300.0 - rem_seconds)

                overall_progress = min(100.0, max(0.0, (elapsed / total_seconds) * 100.0))

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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team/{team_id}/roster")
def get_team_roster(team_id: int):
    """
    Get team roster with player stats.
    Returns player list with basic info and season averages.
    """
    try:
        data = nba_service.get_team_roster(team_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team/{team_id}/gamelog")
def get_team_gamelog(team_id: int, last_n: int = 10):
    """
    Get team's recent game log.
    Returns last N games with stats.
    """
    try:
        data = nba_service.get_team_gamelog(team_id, last_n=last_n)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team/{team_id}/info")
def get_team_info(team_id: int):
    """
    Get team details and season info.
    Returns background, season stats, awards, and retired numbers.
    """
    try:
        data = nba_service.get_team_info(team_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
