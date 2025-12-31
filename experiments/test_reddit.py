import requests
import json
import time
from datetime import datetime

# Fake User-Agent is critical for Reddit
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def search_game_threads():
    """
    Search for 'Game Thread' in r/nba sorted by new to find recent games.
    """
    print("🔍 Searching r/nba for recent Game Threads...")
    
    # Search query: "Game Thread" in r/nba, sorted by new, valid for past 24h usually
    # We restrict to r/nba
    url = "https://www.reddit.com/r/nba/search.json?q=flair%3A%22Game%20Thread%22&restrict_sr=on&sort=new&t=day&limit=10"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Failed to search: {resp.status_code}")
            return []
            
        data = resp.json()
        threads = []
        
        for child in data.get('data', {}).get('children', []):
            t_data = child.get('data', {})
            title = t_data.get('title', '')
            
            # Simple filter for actual Game Threads (usually start with "Game Thread:")
            if "Game Thread" in title:
                threads.append({
                    'id': t_data.get('id'),
                    'title': title,
                    'url': t_data.get('url'),
                    'num_comments': t_data.get('num_comments'),
                    'score': t_data.get('score'),
                    'permalink': t_data.get('permalink')
                })
                
        return threads
        
    except Exception as e:
        print(f"❌ Error searching: {e}")
        return []

def get_thread_comments(thread_id):
    """
    Fetch top comments from a specific thread.
    """
    print(f"📥 Fetching comments for thread {thread_id}...")
    url = f"https://www.reddit.com/comments/{thread_id}.json?sort=top"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Failed to get comments: {resp.status_code}")
            return []
            
        # Reddit returns a list: [ThreadData, CommentData]
        data = resp.json()
        if len(data) < 2:
            return []
            
        comments_data = data[1].get('data', {}).get('children', [])
        comments = []
        
        for c in comments_data:
            c_data = c.get('data', {})
            body = c_data.get('body', '')
            author = c_data.get('author', '')
            score = c_data.get('score', 0)
            
            # Filter out deleted/automod
            if body and author != '[deleted]' and author != 'AutoModerator':
                comments.append({
                    'author': author,
                    'body': body[:100] + "..." if len(body) > 100 else body, # Truncate for display
                    'score': score
                })
                
        return comments
        
    except Exception as e:
        print(f"❌ Error fetching comments: {e}")
        return []

if __name__ == "__main__":
    found_threads = search_game_threads()
    
    if not found_threads:
        print("⚠️ No Game Threads found in the last 24h (Season might be paused or off-hours).")
    else:
        print(f"✅ Found {len(found_threads)} threads:")
        for i, t in enumerate(found_threads):
            print(f"[{i}] {t['title']} (Heat: {t['num_comments']} comments)")
            
        # Pick the first one to test comment fetching
        target = found_threads[0]
        print(f"\n🧪 Testing comment fetch for: {target['title']}")
        top_comments = get_thread_comments(target['id'])
        
        print("\n🔥 Top Comments:")
        for c in top_comments[:5]:
            print(f"  - [{c['score']} upvotes] {c['author']}: {c['body']}")
