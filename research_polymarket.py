import requests
import json
from datetime import datetime

def fetch_polymarket_nba():
    url = "https://gamma-api.polymarket.com/events"
    params = {
        "limit": 20,
        "active": "true",
        "closed": "false",
        "tag_slug": "nba",
        "order": "startDate",
        "ascending": "true"
    }
    
    try:
        print(f"Fetching {url} with params {params}...")
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        
        print(f"Found {len(data)} events. Filtering for Games...\n")
        
        for event in data:
            title = event.get('title', '')
            if 'vs' not in title.lower() and 'game' not in title.lower():
                continue
                
            print(f"Event: {title}")
            print(f"Slug: {event.get('slug')}")
            print(f"Start Date: {event.get('startDate')}")
            
            markets = event.get('markets', [])
            for m in markets:
                # We mostly care about Game Winner (Moneyline)
                q = m.get('question', '')
                if 'win' in q.lower() or 'winner' in q.lower():
                    print(f"  - Market: {q}")
                    print(f"    Outcomes: {m.get('outcomes')}")
                    print(f"    Prices: {m.get('outcomePrices')}")
            print("-" * 40)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_polymarket_nba()
