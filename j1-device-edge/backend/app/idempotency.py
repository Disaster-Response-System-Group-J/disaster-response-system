"""
J1 Bridge API - Idempotency store.

The mobile app sends an Idempotency-Key header with every POST. This bounded,
thread-safe in-memory store prevents duplicate Kafka messages during retries.
For production, replace it with Redis or a database-backed store.
"""

from __future__ import annotations

import threading
from collections import OrderedDict

from .config import settings


class IdempotencyStore:
    """Thread-safe in-memory idempotency store with LRU eviction."""

    def __init__(self, max_keys: int = settings.IDEMPOTENCY_MAX_KEYS):
        self._store: OrderedDict[str, bool] = OrderedDict()
        self._max_keys = max_keys
        self._lock = threading.Lock()

    def contains(self, key: str) -> bool:
        """Return true if the event ID has already been processed."""
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                return True
            return False

    def add(self, key: str) -> None:
        """Mark an event ID as processed."""
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                return
            self._store[key] = True
            while len(self._store) > self._max_keys:
                self._store.popitem(last=False)

    def size(self) -> int:
        """Return the number of stored keys."""
        with self._lock:
            return len(self._store)

    def clear(self) -> None:
        """Clear all stored keys."""
        with self._lock:
            self._store.clear()


idempotency_store = IdempotencyStore()
