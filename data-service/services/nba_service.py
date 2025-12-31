"""
NBA Service
Wraps nba_api for game data access
"""
from typing import Any
from nba_api.live.nba.endpoints import scoreboard, boxscore, playbyplay
from nba_api.stats.static import teams
from nba_api.stats.endpoints import leaguestandings
from . import cache_service


class NBAService:
    """Service for fetching NBA game and team data"""
    
    def __init__(self):
        self._teams_cache = None
    
    def get_today_games(self) -> list[dict[str, Any]]:
        """
        Get all games scheduled for 'NBA Today'.
        Calculates the date based on US/Eastern time.
        """
        from datetime import datetime, timedelta
        
        # Calculate ET time (UTC-5 roughly, ignoring DST nuance for simplicity or use pytz if added)
        # Better: just use UTC and offset
        utc_now = datetime.utcnow()
        # ET is UTC-5 Standard, UTC-4 Daylight. Let's use UTC-5 as base approx.
        # NBA Day changeover usually happens 4AM-6AM ET.
        # Let's say we switch to "next day" at 12:00 PM UTC (7 AM ET).
        # Before 12:00 PM UTC, we might still want to see results of "last night" if we are late?
        # User Feedback: "12/28 almost couldn't load".
        # Current User State: Jan 1 00:32 UTC+8 -> Dec 31 11:32 AM ET.
        # They want to see Dec 31 games.
        
        # Simple Logic: Get current date in ET.
        # If explicit DST handling is needed we need timezone lib, but let's do manual offset -5
        et_now = utc_now - timedelta(hours=5)
        
        # If it's early morning in ET (e.g. before 6 AM), we might consider it "yesterday" 
        # BUT usually "Today" view should show scheduled games for the calendar day.
        # At 11:32 AM ET, Dec 31 -> We want Dec 31.
        
        # Format YYYY-MM-DD
        today_str = et_now.strftime('%Y-%m-%d')
        
        return self.get_games_by_date(today_str)

    def get_games_by_date(self, date_str: str) -> list[dict[str, Any]]:
        """
        Get games for a specific date (YYYY-MM-DD).
        Uses cache for dates where all games are completed.
        """
        # Check cache first
        cached = cache_service.get_cached_games(date_str)
        if cached is not None:
            return cached
        
        try:
            # Use scoreboardv2 for arbitrary dates
            from nba_api.stats.endpoints import scoreboardv2
            board = scoreboardv2.ScoreboardV2(game_date=date_str)
            data = board.get_dict()
            
            # scoreboardv2 structure: resultSets[0] = GameHeader, resultSets[1] = LineScore
            if 'resultSets' not in data or len(data['resultSets']) < 2:
                return []

            headers = data['resultSets'][0]['headers']
            rows = data['resultSets'][0]['rowSet']
            
            # Map headers to indices
            h_map = {h: i for i, h in enumerate(headers)}
            
            games_map = {} # Use dict to deduplicate by ID
            for row in rows:
                game_id = row[h_map['GAME_ID']]
                if game_id in games_map:
                    continue
                    
                home_id = row[h_map['HOME_TEAM_ID']]
                away_id = row[h_map['VISITOR_TEAM_ID']] # VISITOR, not AWAY in v2
                
                # We need to map IDs to Teams manually since V2 doesn't give full objects like live endpoint
                # Or we can fetch LineScore (set 1) which has scores
                # Let's simplify and just get IDs and use basic info if possible
                # But we need scores.
                
                # Fetch LineScore for scores
                line_score_headers = data['resultSets'][1]['headers']
                line_score_rows = data['resultSets'][1]['rowSet']
                ls_map = {h: i for i, h in enumerate(line_score_headers)}
                
                home_score = 0
                away_score = 0
                
                # Find score rows for this game
                for ls_row in line_score_rows:
                    if ls_row[ls_map['GAME_ID']] == game_id:
                        team_id = ls_row[ls_map['TEAM_ID']]
                        pts = ls_row[ls_map['PTS']]
                        if pts is None: pts = 0
                        if team_id == home_id:
                            home_score = pts
                        elif team_id == away_id:
                            away_score = pts

                # Get Team Info from cache
                home_team = self._get_team_info(home_id)
                away_team = self._get_team_info(away_id)
                
                game_status_id = row[h_map['GAME_STATUS_ID']] # 1=Scheduled, 2=In Progress, 3=Final
                status_text = row[h_map['GAME_STATUS_TEXT']] 
                
                games_map[game_id] = {
                    "gameId": game_id,
                    "gameStatus": int(game_status_id),
                    "gameStatusText": status_text,
                    "period": 0,
                    "gameClock": "",
                    "gameTimeUTC": row[h_map['GAME_DATE_EST']], 
                    "homeTeam": {
                        **home_team,
                        "score": home_score
                    },
                    "awayTeam": {
                        **away_team,
                        "score": away_score
                    }
                }
            
            # Check if we need fallback (if games exist but no scores/status is 1)
            # Only check if ALL games are not final? Or check individual?
            # User case: 2025-12-25 has games but all status 1.
            # Let's verify if we have any non-Final games
            needs_fallback = any(g['gameStatus'] == 1 for g in games_map.values())
            
            if needs_fallback:
                try:
                    # Calculate season
                    y, m, d = map(int, date_str.split('-'))
                    season_start_year = y if m >= 10 else y - 1
                    season_str = f"{season_start_year}-{str(season_start_year + 1)[-2:]}"
                    
                    # Log date format MM/DD/YYYY
                    log_date = f"{m:02d}/{d:02d}/{y}"
                    
                    from nba_api.stats.endpoints import leaguegamelog
                    log = leaguegamelog.LeagueGameLog(season=season_start_year, date_from_nullable=log_date, date_to_nullable=log_date)
                    l_data = log.get_dict()
                    
                    if 'resultSets' in l_data and len(l_data['resultSets']) > 0:
                        l_rows = l_data['resultSets'][0]['rowSet']
                        l_headers = l_data['resultSets'][0]['headers']
                        # Map headers
                        l_map = {h: i for i, h in enumerate(l_headers)}
                        
                        # Build score map: TeamID -> Score via game log
                        scores_map = {}
                        for lr in l_rows:
                            tid = lr[l_map['TEAM_ID']]
                            pts = lr[l_map['PTS']]
                            scores_map[tid] = pts
                            
                        # Update games
                        for gid, game in games_map.items():
                            if game['gameStatus'] == 1:
                                home_id = game['homeTeam']['teamId']
                                away_id = game['awayTeam']['teamId']
                                
                                if home_id in scores_map and away_id in scores_map:
                                    game['homeTeam']['score'] = scores_map[home_id]
                                    game['awayTeam']['score'] = scores_map[away_id]
                                    game['gameStatus'] = 3 # Mark as Final
                                    game['gameStatusText'] = "Final"
                except Exception:
                    pass  # Silently ignore fallback errors

            # Cache the results if all games are completed
            games_list = list(games_map.values())
            cache_service.cache_games(date_str, games_list)
            
            return games_list
        except Exception:
            # Silently fail
            return []
    
    def _get_team_info(self, team_id: int) -> dict:
        all_teams = self.get_all_teams()
        for t in all_teams:
            if t['id'] == team_id:
                return {
                    "teamId": t['id'],
                    "teamName": t['nickname'],
                    "teamCity": t['city'],
                    "teamTricode": t['abbreviation'],
                }
        return {"teamId": team_id, "teamName": "Unknown", "teamCity": "", "teamTricode": "UNK"}

    def get_all_teams(self) -> list[dict[str, Any]]:
        """
        Get all NBA teams (cached)
        
        Returns:
            List of team dictionaries
        """
        if self._teams_cache is None:
            self._teams_cache = teams.get_teams()
        return self._teams_cache
    
    def get_boxscore(self, game_id: str) -> dict[str, Any]:
        """
        Get boxscore for a specific game.
        Uses cache for completed games.
        """
        # Check cache first
        cached = cache_service.get_cached_boxscore(game_id)
        if cached is not None:
            return cached
        
        try:
            box = boxscore.BoxScore(game_id=game_id)
            data = box.get_dict()
            game_data = data.get("game", {})
            
            # Cache if game is completed (gameStatus = 3)
            if game_data and game_data.get("gameStatus") == 3:
                cache_service.cache_boxscore(game_id, game_data)
            
            return game_data
        except Exception:
            return None

    def get_playbyplay(self, game_id: str) -> dict[str, Any]:
        """
        Get play-by-play data for a specific game
        """
        try:
            pbp = playbyplay.PlayByPlay(game_id=game_id)
            data = pbp.get_dict()
            return data.get("game", {})
        except Exception:
            return None

    def get_standings(self) -> list[dict[str, Any]]:
        """
        Get current league standings
        """
        try:
            ls = leaguestandings.LeagueStandings()
            data = ls.get_dict()
            # Parse resultSets
            if 'resultSets' in data and len(data['resultSets']) > 0:
                result_set = data['resultSets'][0]
                headers = result_set['headers']
                row_set = result_set['rowSet']
                
                standings = []
                for row in row_set:
                    team_data = dict(zip(headers, row))
                    standings.append(team_data)
                return standings
            return []
        except Exception:
            return []

    
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
