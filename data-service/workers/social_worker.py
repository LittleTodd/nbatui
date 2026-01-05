"""
Social Prefetch Worker
Background task to cache social buzz for finished games.
Only caches 2+ hours after game ends to ensure upvotes have accumulated.
"""
import asyncio
import threading
import time
from datetime import datetime, timedelta
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
        """Fetch today's games and cache social data for finished ones (2+ hours old)"""
        try:
            print("[SocialWorker] Checking for finished games to cache...")
            games = self.nba_service.get_today_games()
            
            for game in games:
                if not self.running:
                    break

                # 1. Check if Game is Final (Status 3)
                if game.get('gameStatus') != 3:
                    continue
                
                game_id = game.get('gameId')
                if not game_id:
                    continue
                
                # 2. Record game end time (only records once)
                cache_service.record_game_end_time(game_id)
                
                # 3. Check if 2+ hours have passed since game ended
                end_time = cache_service.get_game_end_time(game_id)
                if not end_time:
                    continue
                    
                if datetime.now() < end_time + timedelta(hours=2):
                    # Game ended less than 2 hours ago, skip for now
                    continue
                
                # 4. Get team names and date for cache keys
                team1 = game['awayTeam']['teamName']
                team2 = game['homeTeam']['teamName']
                # Use localDate (converted to user's timezone) for consistent cache keys
                game_date = game.get('localDate') or game.get('gameTimeUTC', '').split('T')[0]
                
                if not game_date: 
                    continue

                # 5. Check Heat Cache - only fetch if not already cached
                heat_key = f"heat_{team1}_{team2}_{game_date}"
                if not cache_service.get_cached_social(heat_key):
                    print(f"[SocialWorker] Prefetching Heat for {team1} vs {team2} (2h+ passed)...")
                    self._prefetch_heat(team1, team2, heat_key)
                    time.sleep(5)  # Be polite to Reddit API

                # 6. Check Comments Cache
                limit = 5
                comments_key = f"comments_{team1}_{team2}_{game_date}_{limit}"
                if not cache_service.get_cached_social(comments_key):
                    print(f"[SocialWorker] Prefetching Comments for {team1} vs {team2} (2h+ passed)...")
                    self._prefetch_comments(team1, team2, comments_key, limit)
                    time.sleep(5)

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
