"""
Reddit Service for fetching r/nba Game Thread data.
Uses direct JSON endpoints with User-Agent spoofing to avoid API keys (for public read-only access).
"""
import requests
import urllib.parse
from typing import Optional, Dict, List, Any

# Fake User-Agent is critical for Reddit to not block requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 NBA-TUI/1.0'
}

class RedditService:
    def __init__(self):
        self.base_url = "https://www.reddit.com"

    def find_game_thread(self, team1: str, team2: str) -> Optional[Dict[str, Any]]:
        """
        Search for an active or recent Game Thread for the given matchup.
        Retuns thread metadata if found.
        """
        # Search query: "Game Thread" + team names, sorted by new
        # We try to be specific to find the actual Game Thread
        # Remove quotes around team names to be more lenient
        query = f'flair:"Game Thread" {team1} {team2}'
        encoded_query = urllib.parse.quote(query)
        
        # Search last month to capture recent past games
        url = f"{self.base_url}/r/nba/search.json?q={encoded_query}&restrict_sr=on&sort=new&t=month&limit=5"
        
        try:
            print(f"[Reddit] Searching: {url}", flush=True)
            resp = requests.get(url, headers=HEADERS, timeout=5)
            if resp.status_code != 200:
                print(f"[Reddit] Search failed: {resp.status_code} - {resp.text}", flush=True)
                return None
                
            data = resp.json()
            children = data.get('data', {}).get('children', [])
            print(f"[Reddit] Found {len(children)} threads for {team1} vs {team2}", flush=True)
            
            for child in children:
                t_data = child.get('data', {})
                title = t_data.get('title', '')
                
                # Double check that it looks like a game thread and contains team names
                # (Search can be fuzzy)
                # Note: Game threads usually are "Game Thread: Team A @ Team B" or similar
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
            print(f"[Reddit] Error finding thread: {e}", flush=True)
            return None

    def get_thread_details(self, thread_id: str) -> Dict[str, Any]:
        """
        Get comment count and basic stats for a known thread ID.
        Useful if we cached the ID and just want to update heat.
        """
        # We can just fetch the thread JSON directly to get updated num_comments
        # Actually, fetching the comments endpoint gives post data + comments
        url = f"{self.base_url}/comments/{thread_id}.json?sort=new&limit=1"
        
        try:
            resp = requests.get(url, headers=HEADERS, timeout=5)
            if resp.status_code != 200:
                return {}
                
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
            print(f"[Reddit] Error fetching thread details: {e}")
            return {}

    def get_top_comments(self, thread_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch top comments for a thread.
        """
        url = f"{self.base_url}/comments/{thread_id}.json?sort=top&limit={limit*3}" # Fetch more to filter
        
        try:
            resp = requests.get(url, headers=HEADERS, timeout=5)
            if resp.status_code != 200:
                return []
                
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
                    
                # Simple "funny" filter? For now just take top score.
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
            print(f"[Reddit] Error fetching comments: {e}")
            return []
