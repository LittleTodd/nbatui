"""
NBA Service
Wraps nba_api for game data access
"""
from typing import Any
from nba_api.live.nba.endpoints import scoreboard
from nba_api.stats.static import teams


class NBAService:
    """Service for fetching NBA game and team data"""
    
    def __init__(self):
        self._teams_cache = None
    
    def get_today_games(self) -> list[dict[str, Any]]:
        """
        Get all games scheduled for today with live scores
        
        Returns:
            List of game dictionaries with scores and status
        """
        try:
            board = scoreboard.ScoreBoard()
            data = board.get_dict()
            games = data.get("scoreboard", {}).get("games", [])
            return self._format_games(games)
        except Exception as e:
            print(f"Error fetching today's games: {e}")
            return []
    
    def get_all_teams(self) -> list[dict[str, Any]]:
        """
        Get all NBA teams (cached)
        
        Returns:
            List of team dictionaries
        """
        if self._teams_cache is None:
            self._teams_cache = teams.get_teams()
        return self._teams_cache
    
    def _format_games(self, games: list[dict]) -> list[dict[str, Any]]:
        """Format raw game data into a cleaner structure"""
        formatted = []
        for game in games:
            formatted.append({
                "gameId": game.get("gameId"),
                "gameStatus": game.get("gameStatus"),  # 1=Scheduled, 2=InProgress, 3=Final
                "gameStatusText": game.get("gameStatusText"),
                "period": game.get("period"),
                "gameClock": game.get("gameClock"),
                "gameTimeUTC": game.get("gameTimeUTC"),
                "homeTeam": {
                    "teamId": game.get("homeTeam", {}).get("teamId"),
                    "teamName": game.get("homeTeam", {}).get("teamName"),
                    "teamCity": game.get("homeTeam", {}).get("teamCity"),
                    "teamTricode": game.get("homeTeam", {}).get("teamTricode"),
                    "score": game.get("homeTeam", {}).get("score", 0),
                },
                "awayTeam": {
                    "teamId": game.get("awayTeam", {}).get("teamId"),
                    "teamName": game.get("awayTeam", {}).get("teamName"),
                    "teamCity": game.get("awayTeam", {}).get("teamCity"),
                    "teamTricode": game.get("awayTeam", {}).get("teamTricode"),
                    "score": game.get("awayTeam", {}).get("score", 0),
                },
            })
        return formatted
