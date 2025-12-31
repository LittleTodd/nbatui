
import sys
import os
import requests
import urllib.parse
import time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def search(query):
    encoded = urllib.parse.quote(query)
    url = f"https://www.reddit.com/r/nba/search.json?q={encoded}&restrict_sr=on&sort=new&t=month&limit=5"
    print(f"Searching: {query}")
    print(f"URL: {url}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code != 200:
            print(f"Response text: {resp.text[:200]}")
            return

        data = resp.json()
        children = data.get('data', {}).get('children', [])
        print(f"Found {len(children)} results.")
        for child in children:
            print(f" - {child['data']['title']}")
    except Exception as e:
        print(f"Error: {e}")

# Try Pistons/Lakers directly
search('flair:"Game Thread" "Pistons" "Lakers"')
