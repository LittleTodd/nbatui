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
                # Process Today and Yesterday to catch games ending after midnight
                from services.timezone_utils import get_local_today
                today = get_local_today()
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                
                self._process_games_for_date(yesterday)
                self._process_games_for_date(today)
            except Exception as e:
                print(f"[SocialWorker] Error in loop: {e}")
            
            # Sleep for 30 minutes before next full check
            # We break it up into small sleeps to allow quick shutdown
            for _ in range(30 * 6): 
                if not self.running: 
                    break
                time.sleep(10)

    def _process_games_for_date(self, date_str: str):
        """Fetch games for a date and cache social data for finished ones (2+ hours old)"""
        try:
            print(f"[SocialWorker] Checking games for {date_str} to prefetch/cache...")
            games = self.nba_service.get_games_by_date(date_str)
            
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

                # 5. Check Heat Cache - only skip if data is mature
                heat_key = f"heat_{team1}_{team2}_{game_date}"
                cached_heat = cache_service.get_cached_social(heat_key)
                if not cached_heat or not cached_heat.get('is_mature', False):
                    print(f"[SocialWorker] Prefetching Heat for {team1} vs {team2} (2h+ passed, {'refreshing immature' if cached_heat else 'new'})...")
                    self._prefetch_heat(team1, team2, heat_key)
                    time.sleep(5)  # Be polite to Reddit API

                # 6. Check Comments Cache - only skip if data is mature
                limit = 5
                comments_key = f"comments_{team1}_{team2}_{game_date}_{limit}"
                cached_comments = cache_service.get_cached_social(comments_key)
                if not cached_comments or not cached_comments.get('is_mature', False):
                    print(f"[SocialWorker] Prefetching Comments for {team1} vs {team2} (2h+ passed, {'refreshing immature' if cached_comments else 'new'})...")
                    self._prefetch_comments(team1, team2, comments_key, limit)
                    time.sleep(5)

        except Exception as e:
            print(f"[SocialWorker] Error fetching games: {e}")

    def _prefetch_heat(self, team1: str, team2: str, key: str):
        # For finished games, prefer Post Game Thread (higher quality comments)
        thread = self.reddit_service.find_game_thread(team1, team2, prefer_pgt=True)
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
            "url": thread['url'],
            "thread_type": thread.get('thread_type'),
            "fetched_at": datetime.now().isoformat(),
            "is_mature": True  # Worker data is always mature
        }
        
        # Save to DB
        cache_service.cache_social(key, result)
        # Also populate mem cache for immediate access
        set_mem_cache(f"heat_{team1}_{team2}", result)

    def _prefetch_comments(self, team1: str, team2: str, key: str, limit: int):
        # For finished games, prefer Post Game Thread (higher quality comments)
        thread = self.reddit_service.find_game_thread(team1, team2, prefer_pgt=True)
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
            
        result = {
            "tweets": formatted_comments, 
            "is_mature": True,
            "thread_type": thread.get('thread_type'),
            "fetched_at": datetime.now().isoformat()
        }  # Worker data is always mature
        
        # Save to DB
        cache_service.cache_social(key, result)
        # Also populate mem cache
        set_mem_cache(f"comments_{team1}_{team2}_{limit}", result)
