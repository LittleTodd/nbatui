"""
Timezone Utilities
All conversions are to the user's LOCAL timezone.
Uses the system timezone which automatically handles DST.

The NBA's own calendar is based on US Eastern Time (ET). A game that tips at
7:00 PM ET on Jan 5 is still "Jan 5" for the NBA, but it is Jan 6 in Asia.
Every date-sensitive endpoint should therefore work with two dates:

* ``local_date`` - the user's calendar date (what the TUI displays)
* ``et_date``    - the NBA/ET calendar date (what the stats API queries)

Use :func:`utc_to_local_date` and :func:`utc_to_et_date` to derive them from
the same UTC timestamp so they can never drift apart.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    ZoneInfo = None  # type: ignore[assignment]

# Eastern Time is the NBA's canonical calendar timezone.
ET_TZ = ZoneInfo("America/New_York") if ZoneInfo is not None else None


def _parse_utc_datetime(utc_str: str) -> datetime:
    """
    Parse an ISO-8601 timestamp as UTC.

    Handles:
    - "2026-01-06T03:00:00Z"
    - "2026-01-06T03:00:00+00:00"
    - "2026-01-06T03:00:00" (no offset -> assume UTC)
    - "2026-01-06" (date only -> UTC midnight)
    """
    if not utc_str:
        return datetime.now(timezone.utc)

    value = utc_str.strip().replace("Z", "+00:00")

    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        # Fall back to a date-only value rather than returning "now", which
        # would silently shift data to the wrong day.
        parsed = datetime.fromisoformat(value[:10] + "T00:00:00+00:00")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def get_local_today() -> str:
    """
    Get today's date in the user's local timezone.
    Returns YYYY-MM-DD format.
    """
    return datetime.now().strftime("%Y-%m-%d")


def utc_to_local_datetime(utc_str: str) -> datetime:
    """
    Convert a UTC datetime string to the user's local datetime.
    Automatically handles DST via the system timezone.
    """
    return _parse_utc_datetime(utc_str).astimezone()


def utc_to_local_date(utc_str: str) -> str:
    """
    Convert a UTC datetime string to the user's local date (YYYY-MM-DD).
    This is the PRIMARY function for deciding which "local day" a game is on.

    Example (Asia/Shanghai, UTC+8):
    - "2026-01-06T03:00:00Z" -> "2026-01-06" (11:00 AM local)
    """
    return utc_to_local_datetime(utc_str).strftime("%Y-%m-%d")


def utc_to_local_time(utc_str: str) -> str:
    """
    Convert a UTC datetime string to a local time string (HH:MM AM/PM).
    """
    return utc_to_local_datetime(utc_str).strftime("%I:%M %p").lstrip("0")


def utc_to_et_datetime(utc_str: str) -> datetime:
    """Convert a UTC datetime string to US Eastern Time (DST-aware)."""
    parsed = _parse_utc_datetime(utc_str)
    if ET_TZ is not None:
        return parsed.astimezone(ET_TZ)
    # Best-effort fallback if tzdata is unavailable. DST will be wrong, but
    # the date will at least be close instead of crashing.
    return parsed.astimezone(timezone(timedelta(hours=-5)))


def utc_to_et_date(utc_str: str) -> str:
    """
    Convert a UTC datetime string to the NBA/ET calendar date (YYYY-MM-DD).

    Example:
    - "2026-01-06T03:00:00Z" (7:00 PM ET Jan 5) -> "2026-01-05"
    """
    return utc_to_et_datetime(utc_str).strftime("%Y-%m-%d")


def local_utc_offset(date_str: str) -> timedelta:
    """UTC offset for the user's local timezone at noon on ``date_str``."""
    local_noon = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=12)
    return local_noon.astimezone().utcoffset() or timedelta(0)


def et_utc_offset(date_str: str) -> timedelta:
    """UTC offset for US Eastern Time at noon on ``date_str``."""
    et_noon = datetime.strptime(date_str, "%Y-%m-%d").replace(hour=12)
    if ET_TZ is not None:
        return et_noon.replace(tzinfo=ET_TZ).utcoffset() or timedelta(0)
    return timedelta(hours=-5)


def hours_ahead_of_et(date_str: str) -> float:
    """How many hours the user's timezone is ahead of ET on ``date_str``."""
    delta = local_utc_offset(date_str) - et_utc_offset(date_str)
    return delta.total_seconds() / 3600.0


def nba_date_candidates(local_date: str) -> list[str]:
    """
    Return the NBA/ET calendar dates that may contain games for ``local_date``.

    This is a fallback for when the full season schedule is unavailable. It is
    intentionally conservative:

    * US timezones (UTC offset <= ET): the local date is the NBA date.
    * Asia/Oceania (>= 12 hours ahead): NBA games from the previous ET day.
    * Europe/middle offsets: both days are possible because afternoon ET games
      can stay on the same local day while evening ET games roll over midnight.

    Ordered by likelihood. Callers should query each candidate and filter by the
    game's real UTC tip-off time when available.
    """
    try:
        hours = hours_ahead_of_et(local_date)
    except (ValueError, TypeError):
        return [local_date]

    day = datetime.strptime(local_date, "%Y-%m-%d").date()
    previous = (day - timedelta(days=1)).isoformat()

    if hours >= 12:
        return [previous]
    if hours <= 0:
        return [local_date]
    return [previous, local_date]


# Legacy helpers kept for backward compatibility during migration.
def get_nba_today() -> str:
    """DEPRECATED: Use :func:`get_local_today` instead."""
    return get_local_today()


def convert_et_to_local_date(datetime_str: str) -> str:
    """DEPRECATED: Use :func:`utc_to_local_date` instead."""
    return utc_to_local_date(datetime_str)


# For debugging and testing
if __name__ == "__main__":
    print(f"Local today: {get_local_today()}")
    print(f"Hours ahead of ET: {hours_ahead_of_et(get_local_today())}")

    test_cases = [
        "2026-01-06T03:00:00Z",
        "2026-01-07T01:30:00Z",
        "2026-07-01T02:00:00Z",
        "2026-01-06",
    ]

    print("\nTest conversions (in your local timezone):")
    for utc_str in test_cases:
        print(
            f"  {utc_str} -> local {utc_to_local_date(utc_str)} "
            f"{utc_to_local_time(utc_str)} | ET {utc_to_et_date(utc_str)}"
        )
