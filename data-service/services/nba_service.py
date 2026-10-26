"""
NBA Service
Wraps nba_api for game data access
"""
from typing import Any
from nba_api.live.nba.endpoints import scoreboard, boxscore, playbyplay
from nba_api.stats.static import teams
from nba_api.stats.endpoints import leaguestandings, commonteamroster, teamgamelog, teaminfocommon, teamdetails, teamplayerdashboard
from . import cache_service, schedule_service


class NBAService:
    """Service for fetching NBA game and team data"""
    
    def __init__(self):
        self._teams_cache = None
    
    def get_today_games(self) -> list[dict[str, Any]]:
        """
        Get all games scheduled for today (user's local date).
        """
        from .timezone_utils import get_local_today
        
        # Get today's date in user's local timezone
        today_str = get_local_today()
        
        return self.get_games_by_date(today_str)

    def get_games_by_date(self, date_str: str) -> list[dict[str, Any]]:
        """
        Get games for a specific local date (YYYY-MM-DD in the user's timezone).

        Resolution order:
        1. Completed-date cache (keyed by local date).
        2. Live API for today (real-time scores and true UTC tip-off times).
        3. Official season schedule -> exact NBA/ET dates for this local date.
        4. Timezone heuristic fallback if the schedule is unavailable.

        The schedule index is authoritative because it knows every game's UTC
        tip-off time. That removes the previous hardcoded "local date - 1"
        assumption, which was correct in Asia but wrong in the US.
        """
        from datetime import datetime, timezone
        from .timezone_utils import (
            get_local_today,
            nba_date_candidates,
            utc_to_et_date,
            utc_to_local_date,
        )

        def normalize_cached(games: list[dict[str, Any]], target_date: str) -> list[dict[str, Any]]:
            """Ensure cached games always carry the display date."""
            for game in games:
                game["localDate"] = target_date
            return games

        is_today = date_str == get_local_today()

        # 1. Cache completed/past dates by LOCAL date. Keys changed semantics
        #    (ET date -> local date), so cache_service clears old rows.
        if not is_today:
            cached = cache_service.get_cached_games(date_str)
            if cached is not None:
                return normalize_cached(cached, date_str)

        # 2. Today: the Live API has the freshest scores and true UTC times.
        if is_today:
            try:
                live_games, nba_game_date = self._fetch_today_games_via_live_api_with_date(date_str)
                if live_games:
                    for game in live_games:
                        game_time = game.get("gameTimeUTC", "")
                        game["localDate"] = utc_to_local_date(game_time) if game_time else date_str
                        game["gameDateET"] = utc_to_et_date(game_time) if game_time else nba_game_date

                    filtered_games = [g for g in live_games if g.get("localDate") == date_str]
                    if filtered_games:
                        print(
                            f"DEBUG: Live API (NBA date: {nba_game_date}) has "
                            f"{len(filtered_games)} games for local date {date_str}"
                        )
                        return filtered_games
                    print(
                        f"DEBUG: Live API (NBA date: {nba_game_date}) has no games "
                        f"for local date {date_str}"
                    )
            except Exception as e:
                print(f"DEBUG: Live API failed for today: {e}, falling back to Stats API")

        # 3. Official schedule: exact local-date -> game mapping.
        schedule = schedule_service.get_index_for_date(date_str)
        schedule_game_ids: set[str] | None = None

        if schedule is not None and schedule.covers(date_str):
            schedule_game_ids = schedule.game_ids_for_local_date(date_str)
            if not schedule_game_ids:
                # Off-day (or a game whose time is not announced yet). Cache the
                # empty result so we do not re-query the stats API every time.
                cache_service.cache_schedule(date_str, [])
                return []
            et_dates = schedule.et_dates_for_local_date(date_str)
        else:
            # Fallback: query the likely ET dates and filter by tip-off time
            # when the stats endpoint gives us one.
            et_dates = nba_date_candidates(date_str)

        # 4. Fetch the stats scoreboard for each relevant ET date.
        games_by_id: dict[str, dict[str, Any]] = {}
        for et_date in et_dates:
            try:
                for game in self._fetch_stats_games(et_date):
                    games_by_id[game["gameId"]] = game
            except Exception as e:
                print(
                    f"[NBA API] Failed for ET date {et_date} (local {date_str}): {e}",
                    flush=True,
                )

        games_list = list(games_by_id.values())

        # 5. Keep only the games that actually belong to this local date.
        if schedule_game_ids is not None:
            games_list = [g for g in games_list if g["gameId"] in schedule_game_ids]
        else:
            games_list = [
                g
                for g in games_list
                if (g.get("localDate") or date_str) == date_str
            ]

        # 6. Enrich with exact tip-off times and both calendar dates.
        if schedule is not None:
            for game in games_list:
                game_id = game.get("gameId", "")
                tipoff = schedule.tipoff_utc(game_id)
                if tipoff:
                    game["gameTimeUTC"] = tipoff
                game["gameDateET"] = schedule.et_date(game_id) or game.get("gameDateET")
                game["localDate"] = schedule.local_date(game_id) or date_str
        else:
            for game in games_list:
                game.setdefault("localDate", date_str)
                if not game.get("gameDateET") and game.get("gameTimeUTC"):
                    game["gameDateET"] = utc_to_et_date(game["gameTimeUTC"])

        # 7. Merge live scores when today's games are in progress.
        has_live_games = any(g.get("gameStatus") == 2 for g in games_list)
        if games_list and (has_live_games or is_today):
            try:
                print(f"DEBUG: Attempting to merge live scores. is_today={is_today}")
                games_list = self._merge_live_scores(games_list)
                print(f"DEBUG: Merge successful. Games count: {len(games_list)}")
            except Exception as e:
                print(f"DEBUG: Merge failed: {e}")
                import traceback

                traceback.print_exc()

        # 8. Cache by LOCAL date. Empty off-days are cached via cache_schedule.
        all_completed = bool(games_list) and all(
            g.get("gameStatus") == 3 for g in games_list
        )
        all_scheduled = bool(games_list) and all(
            g.get("gameStatus") == 1 for g in games_list
        )

        if all_completed:
            cache_service.cache_games(date_str, games_list)
        elif all_scheduled:
            cache_service.cache_schedule(date_str, games_list)

        return games_list

    def _fetch_stats_games(self, et_date: str) -> list[dict[str, Any]]:
        """
        Fetch one NBA/ET calendar day from Stats API ``ScoreboardV2``.

        ``gameTimeUTC`` is left empty here; the caller fills it from the season
        schedule. This matters because ``GAME_DATE_EST`` is not a UTC timestamp
        even though the API renders it with a ``T00:00:00`` suffix.
        """
        from datetime import datetime, timezone

        from nba_api.stats.endpoints import scoreboardv2

        from .timezone_utils import utc_to_et_date

        board = scoreboardv2.ScoreboardV2(game_date=et_date)
        data = board.get_dict()

        # scoreboardv2 structure: resultSets[0] = GameHeader, [1] = LineScore
        if "resultSets" not in data or len(data["resultSets"]) < 2:
            return []

        headers = data["resultSets"][0]["headers"]
        rows = data["resultSets"][0]["rowSet"]
        header_map = {name: index for index, name in enumerate(headers)}

        line_score_headers = data["resultSets"][1]["headers"]
        line_score_rows = data["resultSets"][1]["rowSet"]
        line_score_map = {
            name: index for index, name in enumerate(line_score_headers)
        }

        games: dict[str, dict[str, Any]] = {}

        for row in rows:
            game_id = row[header_map["GAME_ID"]]
            if game_id in games:
                continue

            home_id = row[header_map["HOME_TEAM_ID"]]
            away_id = row[header_map["VISITOR_TEAM_ID"]]

            home_score = 0
            away_score = 0
            for line_row in line_score_rows:
                if line_row[line_score_map["GAME_ID"]] != game_id:
                    continue
                team_id = line_row[line_score_map["TEAM_ID"]]
                points = line_row[line_score_map["PTS"]]
                if points is None:
                    points = 0
                if team_id == home_id:
                    home_score = points
                elif team_id == away_id:
                    away_score = points

            home_team = self._get_team_info(home_id)
            away_team = self._get_team_info(away_id)

            games[game_id] = {
                "gameId": game_id,
                "gameStatus": int(row[header_map["GAME_STATUS_ID"]]),
                "gameStatusText": row[header_map["GAME_STATUS_TEXT"]],
                "period": 0,
                "gameClock": "",
                # Filled from the season schedule by the caller. Never put
                # GAME_DATE_EST here: it is an ET date, not a UTC timestamp.
                "gameTimeUTC": "",
                "gameDateET": et_date,
                "homeTeam": {**home_team, "score": home_score},
                "awayTeam": {**away_team, "score": away_score},
            }

        # Recover scores for games that ScoreboardV2 still reports as scheduled
        # even though the ET date is in the past. This is the legacy fallback
        # for occasional stats-API lag.
        if games and any(g["gameStatus"] == 1 for g in games.values()):
            now_et_date = utc_to_et_date(datetime.now(timezone.utc).isoformat())
            if et_date < now_et_date:
                self._fill_scores_from_gamelog(list(games.values()), et_date)

        return list(games.values())

    def _fill_scores_from_gamelog(
        self, games_list: list[dict[str, Any]], et_date: str
    ) -> None:
        """Best-effort score recovery from LeagueGameLog for past ET dates."""
        try:
            from datetime import datetime, timezone

            from nba_api.stats.endpoints import leaguegamelog

            from .timezone_utils import utc_to_et_date

            now_et_date = utc_to_et_date(datetime.now(timezone.utc).isoformat())
            if et_date >= now_et_date:
                return

            year, month, day = map(int, et_date.split("-"))
            season_start_year = year if month >= 10 else year - 1
            season_str = f"{season_start_year}-{str(season_start_year + 1)[-2:]}"
            log_date = f"{month:02d}/{day:02d}/{year}"

            log = leaguegamelog.LeagueGameLog(
                season=season_str,
                date_from_nullable=log_date,
                date_to_nullable=log_date,
            )
            log_data = log.get_dict()
            if "resultSets" not in log_data or not log_data["resultSets"]:
                return

            result_set = log_data["resultSets"][0]
            log_headers = result_set["headers"]
            log_rows = result_set["rowSet"]
            log_map = {name: index for index, name in enumerate(log_headers)}

            scores_map: dict[int, int] = {}
            for log_row in log_rows:
                team_id = log_row[log_map["TEAM_ID"]]
                points = log_row[log_map["PTS"]]
                if points is not None:
                    scores_map[team_id] = points

            for game in games_list:
                if game.get("gameStatus") != 1:
                    continue
                home_id = game["homeTeam"]["teamId"]
                away_id = game["awayTeam"]["teamId"]
                if home_id in scores_map and away_id in scores_map:
                    game["homeTeam"]["score"] = scores_map[home_id]
                    game["awayTeam"]["score"] = scores_map[away_id]
                    game["gameStatus"] = 3
                    game["gameStatusText"] = "Final"
        except Exception:
            # The fallback is optional; never break the main endpoint for it.
            return

    def _fetch_today_games_via_live_api_with_date(self, date_str: str) -> tuple[list[dict[str, Any]], str]:
        """
        Fetch games using the Live API (CDN).
        Returns a tuple of (games_list, nba_game_date).
        
        The nba_game_date is the date according to NBA's calendar (Eastern Time),
        which may differ from the user's local date.
        """
        try:
            live_board = scoreboard.ScoreBoard()
            live_data = live_board.get_dict()
            
            if 'scoreboard' not in live_data or 'games' not in live_data['scoreboard']:
                return [], ""
            
            nba_game_date = live_data['scoreboard'].get('gameDate', '')

            games = live_data['scoreboard']['games']
            formatted_games = []
            
            for lg in games:
                # Map Live API fields to our internal format
                formatted_games.append({
                    "gameId": lg['gameId'],
                    "gameStatus": lg['gameStatus'],
                    "gameStatusText": lg['gameStatusText'],
                    "period": lg['period'],
                    "gameClock": self._parse_game_clock(lg['gameClock']),
                    "gameTimeUTC": lg['gameTimeUTC'],
                    # localDate will be added by ensure_local_date in caller
                    "homeTeam": {
                        "teamId": lg['homeTeam']['teamId'],
                        "teamName": lg['homeTeam']['teamName'],
                        "teamCity": lg['homeTeam']['teamCity'],
                        "teamTricode": lg['homeTeam']['teamTricode'],
                        "score": lg['homeTeam']['score']
                    },
                    "awayTeam": {
                        "teamId": lg['awayTeam']['teamId'],
                        "teamName": lg['awayTeam']['teamName'],
                        "teamCity": lg['awayTeam']['teamCity'],
                        "teamTricode": lg['awayTeam']['teamTricode'],
                        "score": lg['awayTeam']['score']
                    }
                })
                
            return formatted_games, nba_game_date
        except Exception as e:
            print(f"Error parsing Live API: {e}")
            raise e

    
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
        Get current league standings with caching.
        Uses 6-hour cache TTL and falls back to stale cache if API fails.
        """
        # Check cache first
        cached = cache_service.get_cached_standings()
        if cached is not None:
            return cached
        
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
                
                # Cache the successful result
                if standings:
                    cache_service.cache_standings(standings)
                
                return standings
            return []
        except Exception as e:
            # API failed, try stale cache as fallback
            print(f"[Standings] API failed: {e}, trying fallback cache", flush=True)
            fallback = cache_service.get_cached_standings_fallback()
            if fallback:
                print(f"[Standings] Using fallback cache with {len(fallback)} teams", flush=True)
                return fallback
            return []

    def get_team_roster(self, team_id: int) -> dict[str, Any]:
        """
        Get team roster with player stats.
        Uses commonteamroster for basic info and teamplayerdashboard for stats.
        Caches for 24 hours.
        """
        cache_key = f"team_roster_{team_id}"
        
        # Check cache first (24h TTL)
        cached = cache_service.get_cached_by_key(cache_key, ttl_hours=24)
        if cached is not None:
            return cached
        
        try:
            # Get basic roster info
            roster = commonteamroster.CommonTeamRoster(team_id=team_id)
            roster_data = roster.get_dict()
            
            players = []
            coaches = []
            
            if 'resultSets' in roster_data:
                for result_set in roster_data['resultSets']:
                    name = result_set.get('name', '')
                    headers = result_set['headers']
                    rows = result_set['rowSet']
                    
                    if name == 'CommonTeamRoster':
                        for row in rows:
                            player = dict(zip(headers, row))
                            players.append({
                                'playerId': player.get('PLAYER_ID'),
                                'name': player.get('PLAYER'),
                                'num': player.get('NUM'),
                                'position': player.get('POSITION'),
                                'height': player.get('HEIGHT'),
                                'weight': player.get('WEIGHT'),
                                'age': player.get('AGE'),
                                'exp': player.get('EXP'),
                                'school': player.get('SCHOOL'),
                            })
                    elif name == 'Coaches':
                        for row in rows:
                            coach = dict(zip(headers, row))
                            coaches.append({
                                'coachId': coach.get('COACH_ID'),
                                'name': coach.get('COACH_NAME'),
                                'type': coach.get('COACH_TYPE'),
                                'isAssistant': coach.get('IS_ASSISTANT'),
                            })
            
            # Try to get player stats from teamplayerdashboard
            try:
                dashboard = teamplayerdashboard.TeamPlayerDashboard(team_id=team_id)
                dash_data = dashboard.get_dict()
                
                # Build stats lookup by player_id
                stats_lookup = {}
                if 'resultSets' in dash_data:
                    for result_set in dash_data['resultSets']:
                        if result_set.get('name') == 'PlayersSeasonTotals':
                            headers = result_set['headers']
                            rows = result_set['rowSet']
                            for row in rows:
                                player_stats = dict(zip(headers, row))
                                pid = player_stats.get('PLAYER_ID')
                                gp = player_stats.get('GP', 1) or 1
                                # Calculate per-game averages
                                stats_lookup[pid] = {
                                    'gp': gp,
                                    'ppg': round(player_stats.get('PTS', 0) / gp, 1),
                                    'rpg': round(player_stats.get('REB', 0) / gp, 1),
                                    'apg': round(player_stats.get('AST', 0) / gp, 1),
                                    'spg': round(player_stats.get('STL', 0) / gp, 1),
                                    'bpg': round(player_stats.get('BLK', 0) / gp, 1),
                                    'fgPct': round(player_stats.get('FG_PCT', 0) * 100, 1),
                                    'fg3Pct': round(player_stats.get('FG3_PCT', 0) * 100, 1),
                                    'ftPct': round(player_stats.get('FT_PCT', 0) * 100, 1),
                                    'min': round(player_stats.get('MIN', 0) / gp, 1),
                                }
                
                # Merge stats into players
                for player in players:
                    pid = player.get('playerId')
                    if pid in stats_lookup:
                        player['stats'] = stats_lookup[pid]
                        
            except Exception as e:
                print(f"[TeamRoster] Failed to get player stats: {e}")
            
            result = {
                'teamId': team_id,
                'players': players,
                'coaches': coaches,
            }
            
            # Cache the result
            cache_service.cache_by_key(cache_key, result, ttl_hours=24)
            
            return result
        except Exception as e:
            print(f"[TeamRoster] API failed for team {team_id}: {e}")
            return {'teamId': team_id, 'players': [], 'coaches': []}

    def get_team_gamelog(self, team_id: int, last_n: int = 10) -> dict[str, Any]:
        """
        Get team's recent game log.
        Uses leaguegamelog to get PLUS_MINUS data for opponent score calculation.
        Caches for 1 hour.
        """
        cache_key = f"team_gamelog_{team_id}_{last_n}"
        
        # Check cache (1h TTL)
        cached = cache_service.get_cached_by_key(cache_key, ttl_hours=1)
        if cached is not None:
            return cached
        
        try:
            # Use leaguegamelog which provides PLUS_MINUS
            from nba_api.stats.endpoints import leaguegamelog
            
            # Determine season string (e.g. '2025-26')
            from datetime import datetime
            now = datetime.now()
            season_start_year = now.year if now.month >= 10 else now.year - 1
            season_str = f"{season_start_year}-{str(season_start_year + 1)[-2:]}"

            gamelog = leaguegamelog.LeagueGameLog(season=season_str)
            log_data = gamelog.get_dict()
            
            games = []
            
            if 'resultSets' in log_data and len(log_data['resultSets']) > 0:
                result_set = log_data['resultSets'][0]
                headers = result_set['headers']
                rows = result_set['rowSet']
                
                # Build a map of all games by GAME_ID for opponent lookup
                all_games_by_id: dict[str, list] = {}
                for row in rows:
                    game = dict(zip(headers, row))
                    game_id = game.get('GAME_ID')
                    if game_id:
                        if game_id not in all_games_by_id:
                            all_games_by_id[game_id] = []
                        all_games_by_id[game_id].append(game)
                
                # Filter for the requested team and get last N games
                team_games = [dict(zip(headers, row)) for row in rows if row[headers.index('TEAM_ID')] == team_id]
                
                # Sort by date descending (newest first)
                team_games.sort(key=lambda x: x.get('GAME_DATE', ''), reverse=True)
                
                for game in team_games[:last_n]:
                    pts = game.get('PTS') or 0
                    plus_minus = game.get('PLUS_MINUS') or 0
                    game_id = game.get('GAME_ID')
                    
                    # Try to find opponent score from the same game
                    opp_pts = 0
                    if game_id and game_id in all_games_by_id:
                        for g in all_games_by_id[game_id]:
                            if g.get('TEAM_ID') != team_id:
                                opp_pts = g.get('PTS') or 0
                                break
                    
                    # Fallback: calculate from plus_minus if opponent not found
                    if opp_pts == 0 and plus_minus != 0:
                        opp_pts = pts - plus_minus
                    
                    games.append({
                        'gameId': game_id,
                        'date': game.get('GAME_DATE'),
                        'matchup': game.get('MATCHUP'),
                        'result': game.get('WL'),
                        'wins': 0,  # Not available in leaguegamelog
                        'losses': 0,
                        'points': pts,
                        'oppPoints': opp_pts,
                        'plusMinus': plus_minus,
                        'fgm': game.get('FGM'),
                        'fga': game.get('FGA'),
                        'fgPct': round((game.get('FG_PCT') or 0) * 100, 1),
                        'fg3m': game.get('FG3M'),
                        'fg3a': game.get('FG3A'),
                        'fg3Pct': round((game.get('FG3_PCT') or 0) * 100, 1),
                        'ftm': game.get('FTM'),
                        'fta': game.get('FTA'),
                        'ftPct': round((game.get('FT_PCT') or 0) * 100, 1),
                        'reb': game.get('REB'),
                        'ast': game.get('AST'),
                        'stl': game.get('STL'),
                        'blk': game.get('BLK'),
                        'tov': game.get('TOV'),
                    })
            
            # Calculate current streak
            streak = 0
            streak_type = ''
            if games:
                first_result = games[0].get('result')
                streak_type = first_result
                for g in games:
                    if g.get('result') == first_result:
                        streak += 1
                    else:
                        break
            
            result = {
                'teamId': team_id,
                'games': games,
                'streak': streak,
                'streakType': streak_type,  # 'W' or 'L'
            }
            
            # Cache the result
            cache_service.cache_by_key(cache_key, result, ttl_hours=1)
            
            return result
        except Exception as e:
            print(f"[TeamGamelog] API failed for team {team_id}: {e}")
            return {'teamId': team_id, 'games': [], 'streak': 0, 'streakType': ''}

    def get_team_info(self, team_id: int) -> dict[str, Any]:
        """
        Get team details and season info.
        Uses teamdetails for background info and teaminfocommon for season stats.
        Caches for 7 days.
        """
        cache_key = f"team_info_{team_id}"
        
        # Check cache (7 day TTL)
        cached = cache_service.get_cached_by_key(cache_key, ttl_hours=168)
        if cached is not None:
            return cached
        
        try:
            result = {
                'teamId': team_id,
                'background': {},
                'seasonInfo': {},
                'seasonRanks': {},
                'championships': [],
                'confTitles': [],
                'divTitles': [],
                'retiredNumbers': [],
                'hallOfFame': [],
            }
            
            # Get team details (background, history, awards)
            try:
                details = teamdetails.TeamDetails(team_id=team_id)
                details_data = details.get_dict()
                
                if 'resultSets' in details_data:
                    for result_set in details_data['resultSets']:
                        name = result_set.get('name', '')
                        headers = result_set['headers']
                        rows = result_set['rowSet']
                        
                        if name == 'TeamBackground' and rows:
                            bg = dict(zip(headers, rows[0]))
                            result['background'] = {
                                'nickname': bg.get('NICKNAME'),
                                'city': bg.get('CITY'),
                                'arena': bg.get('ARENA'),
                                'arenaCapacity': bg.get('ARENACAPACITY'),
                                'owner': bg.get('OWNER'),
                                'gm': bg.get('GENERALMANAGER'),
                                'headCoach': bg.get('HEADCOACH'),
                                'dLeagueAffiliate': bg.get('DLEAGUEAFFILIATION'),
                                'yearFounded': bg.get('YEARFOUNDED'),
                            }
                        elif name == 'TeamAwardsChampionships':
                            result['championships'] = [
                                {'year': dict(zip(headers, row)).get('YEARAWARDED')}
                                for row in rows
                            ]
                        elif name == 'TeamAwardsConf':
                            result['confTitles'] = [
                                {'year': dict(zip(headers, row)).get('YEARAWARDED')}
                                for row in rows
                            ]
                        elif name == 'TeamAwardsDiv':
                            result['divTitles'] = [
                                {'year': dict(zip(headers, row)).get('YEARAWARDED')}
                                for row in rows
                            ]
                        elif name == 'TeamRetired':
                            for row in rows:
                                retired = dict(zip(headers, row))
                                result['retiredNumbers'].append({
                                    'playerId': retired.get('PLAYERID'),
                                    'player': retired.get('PLAYER'),
                                    'jersey': retired.get('JERSEY'),
                                    'position': retired.get('POSITION'),
                                })
                        elif name == 'TeamHof':
                            for row in rows:
                                hof = dict(zip(headers, row))
                                result['hallOfFame'].append({
                                    'playerId': hof.get('PLAYERID'),
                                    'player': hof.get('PLAYER'),
                                    'position': hof.get('POSITION'),
                                    'year': hof.get('YEAR'),
                                })
            except Exception as e:
                print(f"[TeamInfo] TeamDetails failed: {e}")
            
            # Get team season info (record, rankings)
            try:
                info = teaminfocommon.TeamInfoCommon(team_id=team_id)
                info_data = info.get_dict()
                
                if 'resultSets' in info_data:
                    for result_set in info_data['resultSets']:
                        name = result_set.get('name', '')
                        headers = result_set['headers']
                        rows = result_set['rowSet']
                        
                        if name == 'TeamInfoCommon' and rows:
                            info_row = dict(zip(headers, rows[0]))
                            result['seasonInfo'] = {
                                'seasonYear': info_row.get('SEASON_YEAR'),
                                'teamCity': info_row.get('TEAM_CITY'),
                                'teamName': info_row.get('TEAM_NAME'),
                                'tricode': info_row.get('TEAM_ABBREVIATION'),
                                'conference': info_row.get('TEAM_CONFERENCE'),
                                'division': info_row.get('TEAM_DIVISION'),
                                'wins': info_row.get('W'),
                                'losses': info_row.get('L'),
                                'pct': round((info_row.get('PCT') or 0), 3),
                                'confRank': info_row.get('CONF_RANK'),
                                'divRank': info_row.get('DIV_RANK'),
                            }
                        elif name == 'TeamSeasonRanks' and rows:
                            ranks_row = dict(zip(headers, rows[0]))
                            result['seasonRanks'] = {
                                'ptsRank': ranks_row.get('PTS_RANK'),
                                'ptsPg': ranks_row.get('PTS_PG'),
                                'rebRank': ranks_row.get('REB_RANK'),
                                'rebPg': ranks_row.get('REB_PG'),
                                'astRank': ranks_row.get('AST_RANK'),
                                'astPg': ranks_row.get('AST_PG'),
                                'oppPtsRank': ranks_row.get('OPP_PTS_RANK'),
                                'oppPtsPg': ranks_row.get('OPP_PTS_PG'),
                            }
            except Exception as e:
                print(f"[TeamInfo] TeamInfoCommon failed: {e}")
            
            # Cache the result
            cache_service.cache_by_key(cache_key, result, ttl_hours=168)
            
            return result
        except Exception as e:
            print(f"[TeamInfo] API failed for team {team_id}: {e}")
            return {'teamId': team_id, 'background': {}, 'seasonInfo': {}, 'seasonRanks': {}}    
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
