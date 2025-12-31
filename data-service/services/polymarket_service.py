"""
Polymarket API Service
Fetches NBA game odds from Polymarket prediction markets
"""
import requests
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Team name to tricode mapping
TEAM_NAME_TO_TRICODE = {
    "76ers": "PHI", "Bucks": "MIL", "Bulls": "CHI", "Cavaliers": "CLE",
    "Celtics": "BOS", "Clippers": "LAC", "Grizzlies": "MEM", "Hawks": "ATL",
    "Heat": "MIA", "Hornets": "CHA", "Jazz": "UTA", "Kings": "SAC",
    "Knicks": "NYK", "Lakers": "LAL", "Magic": "ORL", "Mavericks": "DAL",
    "Nets": "BKN", "Nuggets": "DEN", "Pacers": "IND", "Pelicans": "NOP",
    "Pistons": "DET", "Raptors": "TOR", "Rockets": "HOU", "Spurs": "SAS",
    "Suns": "PHX", "Thunder": "OKC", "Timberwolves": "MIN", "Trail Blazers": "POR",
    "Warriors": "GSW", "Wizards": "WAS"
}

POLYMARKET_API_BASE = "https://gamma-api.polymarket.com"
NBA_SERIES_ID = "10345"  # 2025-26 NBA Season


def probability_to_decimal_odds(prob: float) -> float:
    """Convert probability (0-1) to decimal odds"""
    if prob <= 0 or prob >= 1:
        return 0.0
    return round(1.0 / prob, 2)


def parse_team_names(title: str) -> tuple:
    """
    Parse Polymarket event title to extract team names.
    Format: "Team1 vs. Team2" or "Team1 vs Team2"
    Returns (away_team, home_team) as tricodes
    """
    # Remove period after 'vs' if present
    title = title.replace("vs.", "vs")
    
    parts = title.split(" vs ")
    if len(parts) != 2:
        return None, None
    
    away_name = parts[0].strip()
    home_name = parts[1].strip()
    
    away_tricode = TEAM_NAME_TO_TRICODE.get(away_name)
    home_tricode = TEAM_NAME_TO_TRICODE.get(home_name)
    
    return away_tricode, home_tricode


def fetch_polymarket_odds() -> Dict:
    """
    Fetch all active NBA game odds from Polymarket.
    Returns a dict keyed by "AWAY_HOME_DATE" for easy matching.
    """
    url = f"{POLYMARKET_API_BASE}/events"
    params = {
        "series_id": NBA_SERIES_ID,
        "active": "true",
        "closed": "false",
        "limit": 50
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        events = response.json()
    except Exception as e:
        logger.error(f"Failed to fetch Polymarket odds: {e}")
        return {}
    
    odds_data = {}
    
    for event in events:
        title = event.get("title", "")
        away_tricode, home_tricode = parse_team_names(title)
        
        if not away_tricode or not home_tricode:
            continue
        
        # Get the moneyline market (usually the first one with matching title)
        markets = event.get("markets", [])
        moneyline_market = None
        for market in markets:
            q = market.get("question", "")
            # The moneyline question usually matches the event title
            if q == title or "vs" in q.lower():
                moneyline_market = market
                break
        
        if not moneyline_market:
            continue
        
        # Parse outcome prices
        try:
            prices_str = moneyline_market.get("outcomePrices", "[]")
            if isinstance(prices_str, str):
                import json
                prices = json.loads(prices_str)
            else:
                prices = prices_str
            
            if len(prices) >= 2:
                away_prob = float(prices[0])
                home_prob = float(prices[1])
                
                # Skip resolved games (100% or 0% probability)
                if away_prob >= 0.999 or away_prob <= 0.001:
                    continue
                if home_prob >= 0.999 or home_prob <= 0.001:
                    continue
                
                away_odds = probability_to_decimal_odds(away_prob)
                home_odds = probability_to_decimal_odds(home_prob)
                
                # Extract date from endDate
                end_date = event.get("endDate", "")
                if end_date:
                    # Parse ISO date and extract YYYY-MM-DD
                    game_date = end_date[:10]
                else:
                    game_date = "unknown"
                
                # Create key for matching
                key = f"{away_tricode}_{home_tricode}_{game_date}"
                
                odds_data[key] = {
                    "awayTeam": away_tricode,
                    "homeTeam": home_tricode,
                    "awayOdds": away_odds,
                    "homeOdds": home_odds,
                    "awayProb": round(away_prob * 100, 1),
                    "homeProb": round(home_prob * 100, 1),
                    "date": game_date,
                    "source": "polymarket"
                }
        except Exception as e:
            logger.warning(f"Failed to parse odds for {title}: {e}")
            continue
    
    return odds_data


def get_odds_for_game(away_tricode: str, home_tricode: str, game_date: str) -> Optional[Dict]:
    """
    Get odds for a specific game.
    game_date should be in YYYY-MM-DD format.
    """
    all_odds = fetch_polymarket_odds()
    
    # Try exact match first
    key = f"{away_tricode}_{home_tricode}_{game_date}"
    if key in all_odds:
        return all_odds[key]
    
    # Try with date offset (timezone differences)
    from datetime import datetime, timedelta
    try:
        dt = datetime.strptime(game_date, "%Y-%m-%d")
        for offset in [-1, 1]:
            alt_date = (dt + timedelta(days=offset)).strftime("%Y-%m-%d")
            alt_key = f"{away_tricode}_{home_tricode}_{alt_date}"
            if alt_key in all_odds:
                return all_odds[alt_key]
    except:
        pass
    
    return None
