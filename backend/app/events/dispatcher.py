"""Lightweight async pub/sub dispatcher used inside the pipeline."""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable, DefaultDict, Dict, List


logger = logging.getLogger("skyshield.events")
EventHandler = Callable[[Dict[str, Any]], Awaitable[None]]


class EventDispatcher:
    def __init__(self) -> None:
        self._handlers: DefaultDict[str, List[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        handlers = [*self._handlers.get(event_type, []), *self._handlers.get("*", [])]
        for handler in handlers:
            try:
                await handler({"type": event_type, "data": payload})
            except Exception:
                logger.exception("event handler failed", extra={"event_type": event_type})
