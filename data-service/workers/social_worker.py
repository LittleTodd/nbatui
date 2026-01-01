"""
Social Prefetch Worker
Background task to cache social buzz for finished games.
"""
import asyncio
import threading
import time
from datetime import datetime
from services.nba_service import NBAService
from services.reddit_service import RedditService
from services import cache_service
from routers.social import set_mem_cache

class SocialPrefetchWorker:
    def __init__(self):
        self.nba_service = NBAService()
        self.reddit_service = RedditService()
        self.running = False
        self.thread = None
        self._lock = threading.Lock()

    def start(self):
        """Start the background worker thread"""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        print("[SocialWorker] Started background prefetcher")

    def stop(self):
        """Stop the background worker"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
            print("[SocialWorker] Stopped")

    def _run_loop(self):
        """Main loop"""
        while self.running:
            try:
                self._process_todays_games()
            except Exception as e:
                print(f"[SocialWorker] Error in loop: {e}")
            
            # Sleep for 30 minutes before next full check
            # We break it up into small sleeps to allow quick shutdown
            for _ in range(30 * 6): 
                if not self.running: 
                    break
                time.sleep(10)

    def _process_todays_games(self):
        """Fetch today's games and cache social data for finished ones"""
        try:
            print("[SocialWorker] Checking for finished games to cache...")
            games = self.nba_service.get_today_games()
            
            for game in games:
                if not self.running:
                    break

                # 1. Check if Game is Final (Status 3)
                if game.get('gameStatus') != 3:
                    continue
                
                # 2. Check if already cached in DB
                team1 = game['awayTeam']['teamName']
                team2 = game['homeTeam']['teamName']
                game_date = game.get('gameTimeUTC', '').split('T')[0]
                
                if not game_date: 
                    continue

                # Check Heat Cache
                heat_key = f"heat_{team1}_{team2}_{game_date}"
                if not cache_service.get_cached_social(heat_key):
                    print(f"[SocialWorker] Prefetching Heat for {team1} vs {team2}...")
                    self._prefetch_heat(team1, team2, heat_key)
                    time.sleep(5) # Be polite

                # Check Comments Cache
                # We usually fetch limit=5 by default
                limit = 5
                comments_key = f"comments_{team1}_{team2}_{game_date}_{limit}"
                if not cache_service.get_cached_social(comments_key):
                    print(f"[SocialWorker] Prefetching Comments for {team1} vs {team2}...")
                    self._prefetch_comments(team1, team2, comments_key, limit)
                    time.sleep(5) # Be polite

        except Exception as e:
            print(f"[SocialWorker] Error fetching games: {e}")

    def _prefetch_heat(self, team1: str, team2: str, key: str):
        thread = self.reddit_service.find_game_thread(team1, team2)
        if not thread:
            return

        count = thread['num_comments']
        level = "cold"
        if count > 1000: level = "fire"
        elif count > 200: level = "hot"
        elif count > 50: level = "warm"
        
        result = {
            "count": count,
            "level": level,
            "trending": count > 500,
            "school_thread_id": thread['id'],
            "url": thread['url']
        }
        
        # Save to DB
        cache_service.cache_social(key, result)
        # Also populate mem cache for immediate access
        set_mem_cache(f"heat_{team1}_{team2}", result)

    def _prefetch_comments(self, team1: str, team2: str, key: str, limit: int):
        thread = self.reddit_service.find_game_thread(team1, team2)
        if not thread:
            return

        comments = self.reddit_service.get_top_comments(thread['id'], limit=limit)
        formatted_comments = []
        for c in comments:
            formatted_comments.append({
                "text": c['body'],
                "user": f"u/{c['author']}",
                "likes": c['score'],
                "id": c['id']
            })
            
        result = {"tweets": formatted_comments}
        
        # Save to DB
        cache_service.cache_social(key, result)
        # Also populate mem cache
        set_mem_cache(f"comments_{team1}_{team2}_{limit}", result)
