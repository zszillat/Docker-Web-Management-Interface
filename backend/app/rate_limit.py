import time
from collections import defaultdict, deque
from typing import Deque, DefaultDict

from fastapi import HTTPException


class RateLimiter:
    """Simple in-memory rate limiter for sensitive operations."""

    def __init__(self, limit: int = 5, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: DefaultDict[str, Deque[float]] = defaultdict(deque)

    def check(self, action: str, user: str) -> None:
        now = time.monotonic()
        key = f"{user}:{action}"
        events = self._events[key]

        while events and now - events[0] > self.window_seconds:
            events.popleft()

        if len(events) >= self.limit:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded for {action}")

        events.append(now)

