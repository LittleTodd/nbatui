"""
Timezone Utilities
Converts NBA API times (US Eastern) to user's local timezone.
This ensures all dates used throughout the app are consistent.
"""
from datetime import datetime, timedelta, timezone
import time


def get_local_utc_offset_hours() -> float:
    """
    Get the local timezone's UTC offset in hours.
    Positive for east of UTC (e.g., +8 for Beijing).
    """
    # time.timezone gives offset west of UTC in seconds (negative for east)
    # time.daylight indicates if DST is currently active
    if time.daylight and time.localtime().tm_isdst > 0:
        offset_seconds = -time.altzone
    else:
        offset_seconds = -time.timezone
    return offset_seconds / 3600


def get_local_today() -> str:
    """
    Get today's date in the local timezone.
    Returns YYYY-MM-DD format.
    """
    return datetime.now().strftime('%Y-%m-%d')


def convert_utc_to_local(utc_datetime_str: str) -> datetime:
    """
    Convert a UTC datetime string to local datetime.
    Handles formats like:
    - "2026-01-04T00:00:00Z"
    - "2026-01-04T00:00:00"
    - "2026-01-04"
    """
    if not utc_datetime_str:
        return datetime.now()
    
    # Clean up the string
    utc_datetime_str = utc_datetime_str.replace('Z', '')
    
    try:
        if 'T' in utc_datetime_str:
            utc_dt = datetime.fromisoformat(utc_datetime_str)
        else:
            utc_dt = datetime.strptime(utc_datetime_str, '%Y-%m-%d')
    except ValueError:
        # Fallback to now if parsing fails
        return datetime.now()
    
    # Add local offset
    offset_hours = get_local_utc_offset_hours()
    local_dt = utc_dt + timedelta(hours=offset_hours)
    
    return local_dt


def convert_utc_to_local_date(utc_datetime_str: str) -> str:
    """
    Convert a UTC datetime string to local date string (YYYY-MM-DD).
    This is the primary function used for cache keys.
    """
    local_dt = convert_utc_to_local(utc_datetime_str)
    return local_dt.strftime('%Y-%m-%d')


def convert_et_to_local(et_datetime_str: str) -> datetime:
    """
    Convert an Eastern Time datetime string to local datetime.
    ET is typically UTC-5 (EST) or UTC-4 (EDT).
    For simplicity, we use UTC-5.
    
    For date-only strings OR midnight timestamps (T00:00:00), we assume 
    late evening (10 PM ET) since NBA games typically occur then.
    """
    if not et_datetime_str:
        return datetime.now()
    
    try:
        if 'T' in et_datetime_str:
            et_dt = datetime.fromisoformat(et_datetime_str.replace('Z', ''))
            # If it's midnight (T00:00:00), treat as evening game (10 PM)
            # NBA API often stores just the date with midnight time
            if et_dt.hour == 0 and et_dt.minute == 0 and et_dt.second == 0:
                et_dt = et_dt.replace(hour=22)  # 10 PM ET
        else:
            # For date-only, assume 10 PM ET (when most games are in progress)
            et_dt = datetime.strptime(et_datetime_str + " 22:00:00", '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return datetime.now()
    
    # ET to UTC: add 5 hours (EST = UTC-5)
    utc_dt = et_dt + timedelta(hours=5)
    
    # UTC to local
    offset_hours = get_local_utc_offset_hours()
    local_dt = utc_dt + timedelta(hours=offset_hours)
    
    return local_dt


def convert_et_to_local_date(et_datetime_str: str) -> str:
    """
    Convert an Eastern Time datetime string to local date string (YYYY-MM-DD).
    NBA API often uses ET for game dates.
    """
    local_dt = convert_et_to_local(et_datetime_str)
    return local_dt.strftime('%Y-%m-%d')


# For debugging
if __name__ == "__main__":
    print(f"Local UTC offset: {get_local_utc_offset_hours()} hours")
    print(f"Local today: {get_local_today()}")
    
    # Test conversion
    test_et = "2026-01-04"
    print(f"ET date '{test_et}' -> Local date: {convert_et_to_local_date(test_et)}")
    
    test_utc = "2026-01-04T02:00:00Z"
    print(f"UTC '{test_utc}' -> Local date: {convert_utc_to_local_date(test_utc)}")
