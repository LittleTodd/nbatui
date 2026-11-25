"""
Polymarket API Service
Fetches NBA game odds from Polymarket prediction markets
"""
import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import requests

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
NBA_SERIES_ID = os.environ.get("POLYMARKET_NBA_SERIES_ID", "10345")

CACHE_TTL = 60  # 1 minute for game odds
PROPS_CACHE_TTL = 300  # 5 minutes for season props
ERROR_BACKOFF_SECONDS = 15

_odds_lock = threading.Lock()
_odds_cache: Dict = {"data": {}, "timestamp": 0.0}

_props_lock = threading.Lock()
_props_cache: Dict = {"data": {}, "timestamp": 0.0}


def probability_to_decimal_odds(prob: float) -> float:
    """Convert probability (0-1) to decimal odds"""
    if prob <= 0 or prob >= 1:
        return 0.0
    return round(1.0 / prob, 2)


def _match_team_tricode(name: str) -> Optional[str]:
    """Match a team nickname or full name (e.g. 'Los Angeles Lakers' or 'Lakers') to its tricode."""
    cleaned = name.strip()
    if cleaned in TEAM_NAME_TO_TRICODE:
        return TEAM_NAME_TO_TRICODE[cleaned]
    lower = cleaned.lower()
    for nickname, tricode in TEAM_NAME_TO_TRICODE.items():
        if nickname.lower() in lower:
            return tricode
    return None


def parse_team_names(title: str) -> tuple:
    """
    Parse Polymarket event title to extract team names.
    Format: "Team1 vs. Team2" or "Team1 vs Team2"
    Returns (away_team, home_team) as tricodes
    """
    title = title.replace("vs.", "vs")
    parts = title.split(" vs ")
    if len(parts) != 2:
        return None, None

    away_tricode = _match_team_tricode(parts[0])
    home_tricode = _match_team_tricode(parts[1])
    return away_tricode, home_tricode


def _parse_json_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []
    return []


def fetch_polymarket_odds() -> Dict:
    """
    Fetch all active NBA game odds from Polymarket.
    Returns a dict keyed by "AWAY_HOME_DATE" for easy matching.
    Thread-safe with 60s TTL and 15s error backoff to prevent thundering herd.
    """
    global _odds_cache

    with _odds_lock:
        now = time.time()
        if now - _odds_cache["timestamp"] < CACHE_TTL:
            return _odds_cache["data"]

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
            # Apply short error backoff so concurrent/subsequent callers don't hammer failing API
            _odds_cache["timestamp"] = now - CACHE_TTL + ERROR_BACKOFF_SECONDS
            return _odds_cache["data"]

        odds_data = {}

        for event in events:
            title = event.get("title", "")
            away_tricode, home_tricode = parse_team_names(title)
            if not away_tricode or not home_tricode:
                continue

            markets = event.get("markets", [])
            moneyline_market = None

            for market in markets:
                if market.get("question", "") == title:
                    moneyline_market = market
                    break

            if not moneyline_market:
                for market in markets:
                    q = market.get("question", "")
                    q_lower = q.lower()
                    if "vs" in q_lower and not any(
                        x in q_lower for x in ["o/u", "spread", "points", "rebounds", "assists", "1h", "1q"]
                    ):
                        moneyline_market = market
                        break

            if not moneyline_market:
                continue

            try:
                prices = _parse_json_list(moneyline_market.get("outcomePrices", "[]"))
                if len(prices) < 2:
                    continue

                outcomes = _parse_json_list(moneyline_market.get("outcomes", "[]"))
                clob_ids = _parse_json_list(moneyline_market.get("clobTokenIds", "[]"))

                # Align outcome indices with away/home tricodes instead of blindly assuming [0]=away, [1]=home
                away_idx, home_idx = 0, 1
                if len(outcomes) >= 2:
                    out0 = _match_team_tricode(str(outcomes[0]))
                    out1 = _match_team_tricode(str(outcomes[1]))
                    if out0 == home_tricode and out1 == away_tricode:
                        away_idx, home_idx = 1, 0

                away_prob = float(prices[away_idx])
                home_prob = float(prices[home_idx])

                if away_prob >= 0.999 or away_prob <= 0.001:
                    continue
                if home_prob >= 0.999 or home_prob <= 0.001:
                    continue

                away_odds = probability_to_decimal_odds(away_prob)
                home_odds = probability_to_decimal_odds(home_prob)

                end_date = event.get("endDate", "")
                game_date = end_date[:10] if end_date else "unknown"

                away_token = clob_ids[away_idx] if len(clob_ids) >= 2 else None
                home_token = clob_ids[home_idx] if len(clob_ids) >= 2 else None

                raw_volume = moneyline_market.get("volume")
                try:
                    volume = float(raw_volume) if raw_volume not in (None, "") else 0.0
                except (ValueError, TypeError):
                    volume = 0.0

                key = f"{away_tricode}_{home_tricode}_{game_date}"
                odds_data[key] = {
                    "awayTeam": away_tricode,
                    "homeTeam": home_tricode,
                    "awayOdds": away_odds,
                    "homeOdds": home_odds,
                    "awayProb": round(away_prob * 100, 1),
                    "homeProb": round(home_prob * 100, 1),
                    "awayTokenId": away_token,
                    "homeTokenId": home_token,
                    "date": game_date,
                    "source": "polymarket",
                    "volume": volume
                }
            except Exception as e:
                logger.warning(f"Failed to parse odds for {title}: {e}")
                continue

        _odds_cache = {"data": odds_data, "timestamp": time.time()}
        return odds_data


def get_odds_for_game(away_tricode: str, home_tricode: str, game_date: str) -> Optional[Dict]:
    """
    Get odds for a specific game.
    game_date should be in YYYY-MM-DD format.
    """
    all_odds = fetch_polymarket_odds()

    key = f"{away_tricode}_{home_tricode}_{game_date}"
    if key in all_odds:
        return all_odds[key]

    try:
        dt = datetime.strptime(game_date, "%Y-%m-%d")
        for offset in [-1, 1]:
            alt_date = (dt + timedelta(days=offset)).strftime("%Y-%m-%d")
            alt_key = f"{away_tricode}_{home_tricode}_{alt_date}"
            if alt_key in all_odds:
                return all_odds[alt_key]
    except ValueError:
        pass

    return None


def fetch_market_history(clob_id: str) -> List[Dict]:
    """
    Fetch historical prices for a specific CLOB token ID.
    Returns last 48 hours of data with 5 minute resolution.
    """
    if not clob_id:
        return []

    url = "https://clob.polymarket.com/prices-history"
    end_ts = int(time.time())
    start_ts = end_ts - (2 * 86400)

    params = {
        "market": clob_id,
        "startTs": start_ts,
        "endTs": end_ts,
        "fidelity": 5
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 404:
            return []
        response.raise_for_status()
        data = response.json()
        return data.get("history", [])
    except Exception as e:
        logger.error(f"Failed to fetch history for {clob_id}: {e}")
        return []


def fetch_nba_props() -> Dict[str, List[Dict]]:
    """
    Fetch major NBA props: Championship, MVP, Rookie of the Year.
    Cached with thread lock for 5 minutes to avoid sequential 50s latency spikes.
    """
    global _props_cache

    with _props_lock:
        now = time.time()
        if now - _props_cache["timestamp"] < PROPS_CACHE_TTL and _props_cache["data"]:
            return _props_cache["data"]

        props_slugs = {
            "championship": "2026-nba-champion",
            "mvp": "nba-mvp-694",
            "rookie_of_year": "nba-rookie-of-the-year-873",
            "coach_of_year": "nba-2025-26-coach-of-the-year",
            "east_winner": "nba-eastern-conference-champion-442"
        }

        results = {}

        for key, slug in props_slugs.items():
            try:
                url = f"{POLYMARKET_API_BASE}/events"
                response = requests.get(url, params={"slug": slug}, timeout=5)
                response.raise_for_status()
                data = response.json()
                if not data:
                    continue

                event = data[0]
                markets = event.get("markets", [])
                candidates = []

                for market in markets:
                    prices = _parse_json_list(market.get("outcomePrices", "[]"))
                    if not prices:
                        continue

                    prob = float(prices[0])
                    name = market.get("groupItemTitle", "")
                    if not name:
                        q = market.get("question", "")
                        if "Will " in q and " win " in q:
                            name = q.split("Will ")[1].split(" win ")[0]

                    if name and prob > 0.01:
                        candidates.append({
                            "name": name,
                            "probability": round(prob * 100, 1)
                        })

                candidates.sort(key=lambda x: x["probability"], reverse=True)
                results[key] = candidates[:3]
            except Exception:
                continue

        if results:
            _props_cache = {"data": results, "timestamp": time.time()}
            return results

        _props_cache["timestamp"] = now - PROPS_CACHE_TTL + ERROR_BACKOFF_SECONDS
        return _props_cache["data"]
