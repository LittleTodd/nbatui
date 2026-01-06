"""
Timezone Utilities - Simplified Version
All conversions are to user's LOCAL timezone.
Uses system timezone which automatically handles DST.
"""
from datetime import datetime, timezone


def get_local_today() -> str:
    """
    Get today's date in the user's local timezone.
    Returns YYYY-MM-DD format.
    """
    return datetime.now().strftime('%Y-%m-%d')


def utc_to_local_datetime(utc_str: str) -> datetime:
    """
    Convert a UTC datetime string to local datetime.
    Handles formats like:
    - "2026-01-06T03:00:00Z"
    - "2026-01-06T03:00:00"
    - "2026-01-06"
    
    Automatically handles DST via system timezone.
    """
    if not utc_str:
        return datetime.now()
    
    try:
        # Clean up the string and parse
        clean_str = utc_str.replace('Z', '+00:00')
        
        if 'T' in clean_str:
            # Full datetime
            if '+' not in clean_str and '-' not in clean_str[10:]:
                # No timezone info, assume UTC
                clean_str += '+00:00'
            utc_dt = datetime.fromisoformat(clean_str)
        else:
            # Date only - assume midnight UTC
            utc_dt = datetime.fromisoformat(clean_str + 'T00:00:00+00:00')
        
        # Convert to local timezone (automatically handles DST)
        local_dt = utc_dt.astimezone()
        return local_dt
    except (ValueError, TypeError):
        return datetime.now()


def utc_to_local_date(utc_str: str) -> str:
    """
    Convert a UTC datetime string to local date string (YYYY-MM-DD).
    This is the PRIMARY function for determining which "local day" a game belongs to.
    
    Example:
    - "2026-01-06T03:00:00Z" in Beijing (UTC+8) → "2026-01-06" (11:00 AM local)
    - "2026-01-07T02:00:00Z" in Beijing (UTC+8) → "2026-01-07" (10:00 AM local)
    """
    local_dt = utc_to_local_datetime(utc_str)
    return local_dt.strftime('%Y-%m-%d')


def utc_to_local_time(utc_str: str) -> str:
    """
    Convert a UTC datetime string to local time string (HH:MM AM/PM format).
    
    Example:
    - "2026-01-06T03:00:00Z" in Beijing (UTC+8) → "11:00 AM"
    """
    local_dt = utc_to_local_datetime(utc_str)
    return local_dt.strftime('%I:%M %p').lstrip('0')


# Legacy function - now just returns local today
# Kept for backward compatibility during migration
def get_nba_today() -> str:
    """
    DEPRECATED: Use get_local_today() instead.
    Now just returns the local date.
    """
    return get_local_today()


# Legacy function - kept for backward compatibility
def convert_et_to_local_date(datetime_str: str) -> str:
    """
    DEPRECATED: Use utc_to_local_date() instead.
    
    This function previously tried to convert ET to local,
    but the input is actually UTC from NBA API, so we now
    just delegate to utc_to_local_date.
    """
    return utc_to_local_date(datetime_str)


# For debugging and testing
if __name__ == "__main__":
    print(f"Local today: {get_local_today()}")
    
    # Test conversions for different timezones
    test_cases = [
        ("2026-01-06T03:00:00Z", "Typical NBA game (UTC 3 AM)"),
        ("2026-01-07T01:30:00Z", "Late game (UTC 1:30 AM)"),
        ("2026-01-06T00:00:00Z", "Midnight UTC"),
        ("2026-01-06", "Date only"),
    ]
    
    print("\nTest conversions (in your local timezone):")
    for utc_str, description in test_cases:
        local_date = utc_to_local_date(utc_str)
        local_time = utc_to_local_time(utc_str)
        print(f"  {description}")
        print(f"    UTC: {utc_str}")
        print(f"    Local: {local_date} {local_time}")
        print()
