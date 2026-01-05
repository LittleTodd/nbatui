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
        Uses the user's local timezone to determine today's date.
        """
        from .timezone_utils import get_local_today
        
        # Get today's date in user's local timezone
        today_str = get_local_today()
        
        return self.get_games_by_date(today_str)

    def get_games_by_date(self, date_str: str) -> list[dict[str, Any]]:
        """
        Get games for a specific date (YYYY-MM-DD).
        - Uses games_cache for completed dates
        - Uses schedule_cache for future dates (24h TTL)
        """
        from datetime import datetime, timedelta
        from .timezone_utils import convert_et_to_local_date
        
        def ensure_local_date(games: list) -> list:
            """Add localDate field to games if missing"""
            for game in games:
                if not game.get('localDate'):
                    game_time = game.get('gameTimeUTC', date_str)
                    game['localDate'] = convert_et_to_local_date(game_time)
            return games
        
        # Check games_cache first (completed games with scores)
        cached = cache_service.get_cached_games(date_str)
        if cached is not None:
            return ensure_local_date(cached)
        
        # Check schedule_cache for future dates
        schedule_cached = cache_service.get_cached_schedule(date_str)
        if schedule_cached is not None:
            return ensure_local_date(schedule_cached)
        
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
                
                # Convert ET game date to local date for cache key consistency
                from .timezone_utils import convert_et_to_local_date
                game_date_et = row[h_map['GAME_DATE_EST']]
                local_date = convert_et_to_local_date(game_date_et) if game_date_et else date_str
                
                games_map[game_id] = {
                    "gameId": game_id,
                    "gameStatus": int(game_status_id),
                    "gameStatusText": status_text,
                    "period": 0,
                    "gameClock": "",
                    "gameTimeUTC": game_date_et,
                    "localDate": local_date,  # User's local date for this game
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
            
            # HYBRID APPROACH: If any game is LIVE (gameStatus=2), use Live API for real-time scores
            has_live_games = any(g['gameStatus'] == 2 for g in games_list)
            if has_live_games:
                try:
                    games_list = self._merge_live_scores(games_list)
                except Exception:
                    pass  # If Live API fails, keep Stats API data
            
            # Determine caching strategy based on game statuses
            all_completed = all(g['gameStatus'] == 3 for g in games_list)
            all_scheduled = all(g['gameStatus'] == 1 for g in games_list)
            
            if all_completed:
                # Past date with all games finished - cache with scores
                cache_service.cache_games(date_str, games_list)
            elif all_scheduled:
                # Future date - cache schedule (24h TTL)
                cache_service.cache_schedule(date_str, games_list)
            # Don't cache if mixed statuses (today's games in progress)
            
            return games_list
        except Exception:
            # Silently fail
            return []
    
    def _merge_live_scores(self, games_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Merge real-time scores from Live API for games that are in progress.
        Only updates games with gameStatus=2.
        """
        # Fetch Live API scoreboard
        live_board = scoreboard.ScoreBoard()
        live_data = live_board.get_dict()
        
        if 'scoreboard' not in live_data or 'games' not in live_data['scoreboard']:
            return games_list
        
        live_games = live_data['scoreboard']['games']
        
        # Build lookup by gameId
        live_lookup = {}
        for lg in live_games:
            live_lookup[lg['gameId']] = lg
        
        # Merge live data into our games list
        for game in games_list:
            game_id = game['gameId']
            if game_id in live_lookup:
                lg = live_lookup[game_id]
                
                # Update scores
                game['homeTeam']['score'] = lg.get('homeTeam', {}).get('score', game['homeTeam']['score'])
                game['awayTeam']['score'] = lg.get('awayTeam', {}).get('score', game['awayTeam']['score'])
                
                # Update status
                game['gameStatus'] = lg.get('gameStatus', game['gameStatus'])
                game['gameStatusText'] = lg.get('gameStatusText', game['gameStatusText'])
                
                # Update period and clock (for live games)
                game['period'] = lg.get('period', 0)
                raw_clock = lg.get('gameClock', '')
                game['gameClock'] = self._parse_game_clock(raw_clock)
        
        return games_list
    
    def _parse_game_clock(self, iso_clock: str) -> str:
        """
        Parse ISO 8601 duration format (PT06M58.00S) to human readable (6:58).
        """
        if not iso_clock or not iso_clock.startswith('PT'):
            return iso_clock
        
        import re
        # Match pattern like PT06M58.00S or PT12M00.00S
        match = re.match(r'PT(\d+)M([\d.]+)S', iso_clock)
        if match:
            minutes = int(match.group(1))
            seconds = int(float(match.group(2)))
            return f"{minutes}:{seconds:02d}"
        return iso_clock
    
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

    def get_playbyplay(self, game_id: str, game_status: int = None) -> dict[str, Any]:
        """
        Get play-by-play data for a specific game.
        Caches data for completed games (gameStatus=3).
        
        Args:
            game_id: NBA game ID
            game_status: Optional game status (3=Final). If provided, enables caching.
        """
        try:
            # Check cache first for completed games
            if game_status == 3:
                cached = cache_service.get_cached_playbyplay(game_id)
                if cached:
                    return cached
            
            # Fetch from API
            pbp = playbyplay.PlayByPlay(game_id=game_id)
            data = pbp.get_dict()
            game_data = data.get("game", {})
            
            # Cache if game is completed
            if game_status == 3 and game_data:
                cache_service.cache_playbyplay(game_id, game_data)
            
            return game_data
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

    def preload_future_schedules(self, days: int = 14) -> dict:
        """
        Preload game schedules for the next N days.
        Called on startup to ensure smooth browsing of future dates.
        Returns stats about cached dates.
        """
        from datetime import datetime, timedelta
        
        cached_count = 0
        failed_count = 0
        
        today = datetime.now()
        
        for i in range(1, days + 1):
            future_date = today + timedelta(days=i)
            date_str = future_date.strftime('%Y-%m-%d')
            
            # Skip if already cached and not stale
            if cache_service.is_schedule_cached(date_str):
                cached_count += 1
                continue
            
            try:
                # Fetch and cache (will auto-cache if all games are scheduled)
                games = self.get_games_by_date(date_str)
                if games:
                    cached_count += 1
                    print(f"[Preload] Cached schedule for {date_str}: {len(games)} games", flush=True)
            except Exception as e:
                failed_count += 1
                print(f"[Preload] Failed to cache {date_str}: {e}", flush=True)
        
        return {
            "days_requested": days,
            "cached": cached_count,
            "failed": failed_count
        }
