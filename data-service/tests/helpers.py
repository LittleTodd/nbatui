"""Shared helpers for the data-service test suite."""
import os
import time
from contextlib import contextmanager


@contextmanager
def set_timezone(tz: str):
    """
    Temporarily set the process timezone.

    ``TZ`` plus ``time.tzset()`` is what ``datetime.astimezone()`` reads, so the
    timezone helpers can be tested deterministically on any machine.
    """
    original = os.environ.get("TZ")
    os.environ["TZ"] = tz
    time.tzset()
    try:
        yield
    finally:
        if original is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original
        time.tzset()
