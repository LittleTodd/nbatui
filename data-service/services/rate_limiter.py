"""
Rate Limiter Utility
Token bucket algorithm for rate limiting Reddit API requests.
Thread-safe implementation.
"""
import threading
import time
from typing import Optional


class RateLimiter:
    """
    Token bucket rate limiter.
    Allows a burst of requests up to max_tokens, then limits to tokens_per_second rate.
    """
    
    def __init__(self, max_tokens: int = 10, tokens_per_second: float = 0.167):
        """
        Initialize rate limiter.
        
        Args:
            max_tokens: Maximum tokens in bucket (burst capacity)
            tokens_per_second: Token refill rate (default: ~10 per minute = 0.167/s)
        """
        self.max_tokens = max_tokens
        self.tokens_per_second = tokens_per_second
        self.tokens = max_tokens
        self.last_refill = time.time()
        self._lock = threading.Lock()
    
    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        new_tokens = elapsed * self.tokens_per_second
        self.tokens = min(self.max_tokens, self.tokens + new_tokens)
        self.last_refill = now
    
    def acquire(self, timeout: Optional[float] = 30.0) -> bool:
        """
        Acquire a token, blocking if necessary.
        
        Args:
            timeout: Maximum time to wait for token (seconds). None = wait forever.
        
        Returns:
            True if token acquired, False if timeout.
        """
        start_time = time.time()
        
        while True:
            with self._lock:
                self._refill()
                
                if self.tokens >= 1:
                    self.tokens -= 1
                    return True
                
                # Calculate wait time for next token
                wait_time = (1 - self.tokens) / self.tokens_per_second
            
            # Check timeout
            if timeout is not None:
                elapsed = time.time() - start_time
                if elapsed + wait_time > timeout:
                    return False
            
            # Wait for token
            time.sleep(min(wait_time, 1.0))  # Check at least every 1 second
    
    def try_acquire(self) -> bool:
        """
        Try to acquire a token without blocking.
        
        Returns:
            True if token available and acquired, False otherwise.
        """
        with self._lock:
            self._refill()
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False


# Global rate limiter for Reddit requests
# 10 requests per minute max, with burst capacity of 5
reddit_limiter = RateLimiter(max_tokens=5, tokens_per_second=0.167)
