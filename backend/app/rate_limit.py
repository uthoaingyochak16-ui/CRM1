from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    """Small fixed-window limiter for a single-process API deployment."""

    def __init__(self) -> None:
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _key(self, request: Request, scope: str) -> str:
        forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
        address = forwarded or (request.client.host if request.client else "unknown")
        return f"{scope}:{address}"

    def check(
        self, request: Request, *, scope: str, limit: int, window_seconds: int, record: bool = True
    ) -> None:
        key = self._key(request, scope)
        now = monotonic()
        cutoff = now - window_seconds

        with self._lock:
            attempts = self._attempts[key]
            while attempts and attempts[0] <= cutoff:
                attempts.popleft()
            if len(attempts) >= limit:
                retry_after = max(1, int(window_seconds - (now - attempts[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            if record:
                attempts.append(now)

    def reset(self, request: Request, *, scope: str) -> None:
        with self._lock:
            self._attempts.pop(self._key(request, scope), None)


rate_limiter = InMemoryRateLimiter()
