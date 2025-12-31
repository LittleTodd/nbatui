
import sys
import os
import json
import sqlite3

# Fix path to point to usage
sys.path.append(os.path.join(os.getcwd(), 'data-service'))
from services import cache_service

print("Attempting to read cache for 2025-12-28...")
try:
    data = cache_service.get_cached_games("2025-12-28")
    if data:
        print(f"Success! Found {len(data)} games.")
        # print(json.dumps(data, indent=2))
    else:
        print("Cache returned None.")
except Exception as e:
    print(f"Error: {e}")
