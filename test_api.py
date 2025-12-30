from nba_api.live.nba.endpoints import scoreboard
from nba_api.stats.endpoints import scoreboardv2
import json

def test_dates():
    dates = ["2025-12-31"]
    
    from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv2
    
    for d in dates:
        print(f"\nTesting stats.scoreboardv2 for {d}...")
        try:
            board2 = scoreboardv2.ScoreboardV2(game_date=d)
            data2 = board2.get_dict()
            if 'resultSets' in data2 and len(data2['resultSets']) > 0:
                 rows = data2['resultSets'][0]['rowSet']
                 headers = data2['resultSets'][0]['headers']
                 id_idx = headers.index('GAME_ID')
                 
                 game_ids = [r[id_idx] for r in rows]
                 print(f"Total Games found: {len(game_ids)}")
                 
                 # Check Status Text
                 if 'GAME_STATUS_TEXT' in headers:
                     st_idx = headers.index('GAME_STATUS_TEXT')
                     print(f"First Game Status Text: '{rows[0][st_idx]}'")
                     for r in rows:
                         print(f"Game {r[id_idx]} Status: {r[st_idx]}")
                 
                 if len(data2['resultSets']) > 1:
                     ls_headers = data2['resultSets'][1]['headers']
                     ls_rows = data2['resultSets'][1]['rowSet']
                     
                     ls_game_id_idx = ls_headers.index('GAME_ID')
                     ls_pts_idx = ls_headers.index('PTS')
                     ls_team_idx = ls_headers.index('TEAM_ABBREVIATION')
                     
                     all_scores = []
                     # Iterate through games in header to keep order
                     for gid in game_ids:
                         scores = []
                         for r in ls_rows:
                             if r[ls_game_id_idx] == gid:
                                 scores.append(f"{r[ls_team_idx]} {r[ls_pts_idx]}")
                         if scores:
                             all_scores.append(f"Game {gid}: " + " - ".join(scores))
                         else:
                             all_scores.append(f"Game {gid}: No LineScore (Status?)")
                             
                     for s in all_scores:
                         print(s)
                 else:
                     print("No LineScore set found!")
                     
                 # Check BoxScore for first game if found
                 if len(game_ids) > 0:
                     test_id = game_ids[0]
                     print(f"Checking BoxScore for {test_id}...")
                     box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=test_id)
                     b_data = box.get_dict()
                     if 'resultSets' in b_data and len(b_data['resultSets']) > 0:
                         # Team Stats is usually index 1 (TeamStats)
                         ts_headers = b_data['resultSets'][1]['headers']
                         ts_rows = b_data['resultSets'][1]['rowSet']
                         print(f"BoxScore TeamStats: {ts_rows}")
                     else:
                         print("BoxScore empty")
                         
                 # Check LeagueGameLog
                 print("Checking LeagueGameLog...")
                 from nba_api.stats.endpoints import leaguegamelog
                 # Date format MM/DD/YYYY
                 log = leaguegamelog.LeagueGameLog(season='2025-26', date_from_nullable='12/25/2025', date_to_nullable='12/25/2025')
                 l_data = log.get_dict()
                 if 'resultSets' in l_data and len(l_data['resultSets']) > 0:
                     rows = l_data['resultSets'][0]['rowSet']
                     headers = l_data['resultSets'][0]['headers']
                     print(f"GameLog Rows: {len(rows)}")
                     if len(rows) > 0:
                         print(f"GameLog Headers: {headers}")
                         print(f"First Row: {rows[0]}")
                 else:
                     print("GameLog empty")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_dates()
