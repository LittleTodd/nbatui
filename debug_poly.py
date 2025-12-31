
import requests
import json

url = "https://gamma-api.polymarket.com/events?series_id=10345&active=true&limit=1"
try:
    resp = requests.get(url)
    data = resp.json()
    if data:
        event = data[0]
        print("Event:", event.get("title"))
        markets = event.get("markets", [])
        if markets:
            m = markets[0]
            print("Market Keys:", m.keys())
            print("Volume:", m.get("volume"))
            print("Liquidity:", m.get("liquidity"))
            print("Volume24h:", m.get("volume24h"))
except Exception as e:
    print(e)
