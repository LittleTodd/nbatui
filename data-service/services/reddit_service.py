"""
Reddit Service for fetching r/nba Game Thread data.
Uses direct JSON endpoints with User-Agent spoofing to avoid API keys (for public read-only access).
Includes rate limiting and retry logic to avoid 429 errors.
"""
import requests
import urllib.parse
import time
from typing import Optional, Dict, List, Any
from .rate_limiter import reddit_limiter

# Fake User-Agent is critical for Reddit to not block requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 NBA-TUI/1.0'
}

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0  # seconds


def _request_with_retry(url: str, timeout: int = 5) -> Optional[requests.Response]:
    """
    Make a request with rate limiting and exponential backoff retry.
    
    Args:
        url: URL to request
        timeout: Request timeout in seconds
    
    Returns:
        Response object if successful, None if all retries failed.
    """
    backoff = INITIAL_BACKOFF
    
    for attempt in range(MAX_RETRIES):
        # Wait for rate limiter token
        if not reddit_limiter.acquire(timeout=30):
            print(f"[Reddit] Rate limiter timeout, skipping request", flush=True)
            return None
        
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            
            if resp.status_code == 200:
                return resp
            
            if resp.status_code == 429:
                # Rate limited by Reddit, retry with backoff
                print(f"[Reddit] 429 Rate Limited, retry {attempt + 1}/{MAX_RETRIES} after {backoff}s", flush=True)
                time.sleep(backoff)
                backoff *= 2  # Exponential backoff
                continue
            
            # Other errors, don't retry
            print(f"[Reddit] Request failed: {resp.status_code}", flush=True)
            return None
            
        except Exception as e:
            print(f"[Reddit] Request error: {e}", flush=True)
            if attempt < MAX_RETRIES - 1:
                time.sleep(backoff)
                backoff *= 2
            continue
    
    print(f"[Reddit] All retries exhausted", flush=True)
    return None


class RedditService:
    def __init__(self):
        self.base_url = "https://www.reddit.com"

    def find_game_thread(self, team1: str, team2: str) -> Optional[Dict[str, Any]]:
        """
        Search for an active or recent Game Thread for the given matchup.
        Returns thread metadata if found.
        """
        # Search query: "Game Thread" + team names, sorted by new
        query = f'flair:"Game Thread" {team1} {team2}'
        encoded_query = urllib.parse.quote(query)
        
        # Search last month to capture recent past games
        url = f"{self.base_url}/r/nba/search.json?q={encoded_query}&restrict_sr=on&sort=new&t=month&limit=5"
        
        print(f"[Reddit] Searching: {team1} vs {team2}", flush=True)
        resp = _request_with_retry(url)
        
        if not resp:
            return None
        
        try:
            data = resp.json()
            children = data.get('data', {}).get('children', [])
            print(f"[Reddit] Found {len(children)} threads for {team1} vs {team2}", flush=True)
            
            for child in children:
                t_data = child.get('data', {})
                title = t_data.get('title', '')
                
                if "Game Thread" in title:
                    return {
                        "id": t_data.get('id'),
                        "title": title,
                        "num_comments": t_data.get('num_comments', 0),
                        "score": t_data.get('score', 0),
                        "url": t_data.get('url'),
                        "permalink": t_data.get('permalink')
                    }
                    
            return None
            
        except Exception as e:
            print(f"[Reddit] Error parsing response: {e}", flush=True)
            return None

    def get_thread_details(self, thread_id: str) -> Dict[str, Any]:
        """
        Get comment count and basic stats for a known thread ID.
        Useful if we cached the ID and just want to update heat.
        """
        url = f"{self.base_url}/comments/{thread_id}.json?sort=new&limit=1"
        
        resp = _request_with_retry(url)
        if not resp:
            return {}
        
        try:
            data = resp.json()
            if not data or len(data) < 1:
                return {}
                
            post_data = data[0].get('data', {}).get('children', [])[0].get('data', {})
            return {
                "num_comments": post_data.get('num_comments', 0),
                "score": post_data.get('score', 0),
                "upvote_ratio": post_data.get('upvote_ratio', 0)
            }
            
        except Exception as e:
            print(f"[Reddit] Error fetching thread details: {e}", flush=True)
            return {}

    def get_top_comments(self, thread_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch top comments for a thread.
        """
        url = f"{self.base_url}/comments/{thread_id}.json?sort=top&limit={limit*3}"
        
        resp = _request_with_retry(url)
        if not resp:
            return []
        
        try:
            data = resp.json()
            if len(data) < 2:
                return []
                
            children = data[1].get('data', {}).get('children', [])
            comments = []
            
            for child in children:
                c_data = child.get('data', {})
                body = c_data.get('body', '')
                author = c_data.get('author', '')
                
                # Filter bad comments
                if not body or author in ['[deleted]', 'AutoModerator']:
                    continue
                    
                comments.append({
                    "id": c_data.get('id'),
                    "author": author,
                    "body": body,
                    "score": c_data.get('score', 0),
                    "permalink": c_data.get('permalink')
                })
                
                if len(comments) >= limit:
                    break
                    
            return comments
            
        except Exception as e:
            print(f"[Reddit] Error fetching comments: {e}", flush=True)
            return []

