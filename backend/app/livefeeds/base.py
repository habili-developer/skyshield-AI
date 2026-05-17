"""Base classes for independently enabled public live feeds."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict


@dataclass
class LiveFeedStatus:
    name: str
    enabled: bool
    status: str = "ONLINE"
    events_received: int = 0
    last_event_ts: float | None = None
    last_error: str | None = None


class LiveFeedAdapter(ABC):
    feed_type = "generic"

    def __init__(self, name: str, enabled: bool = False) -> None:
        self.name = name
        self.enabled = enabled
        self.status = LiveFeedStatus(name=name, enabled=enabled)

    @abstractmethod
    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        yield {}

    def mark_event(self) -> None:
        self.status.events_received += 1
        self.status.last_event_ts = time.time()
        self.status.status = "ACTIVE"

    def mark_error(self, exc: Exception) -> None:
        self.status.last_error = str(exc)
        self.status.status = "DEGRADED"

    def health(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.feed_type,
            "enabled": self.enabled,
            "status": self.status.status if self.enabled else "ONLINE",
            "events_received": self.status.events_received,
            "last_event_ts": self.status.last_event_ts,
            "last_error": self.status.last_error,
        }
