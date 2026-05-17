"""Async event hub for operational WebSocket streaming."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from backend.app.services.websocket_manager import ConnectionManager


logger = logging.getLogger("skyshield.streaming")
Subscriber = Callable[[Dict[str, Any]], Awaitable[None]]


@dataclass
class StreamStats:
    published: int = 0
    delivered: int = 0
    dropped: int = 0
    last_event_type: Optional[str] = None
    last_event_ts: Optional[float] = None


@dataclass
class StreamHub:
    """Single-process event bus that feeds WebSocket clients and internal subscribers."""

    ws_manager: ConnectionManager
    max_queue_size: int = 1000
    subscribers: List[Subscriber] = field(default_factory=list)
    stats: StreamStats = field(default_factory=StreamStats)

    def __post_init__(self) -> None:
        self.queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue(maxsize=self.max_queue_size)
        self._worker: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._worker = asyncio.create_task(self._run(), name="skyshield-stream-hub")
        logger.info("stream hub started")

    async def stop(self) -> None:
        self._running = False
        if self._worker:
            self._worker.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._worker
        logger.info("stream hub stopped")

    def subscribe(self, subscriber: Subscriber) -> None:
        self.subscribers.append(subscriber)

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        event = {
            "type": event_type,
            "data": payload,
            "stream_ts": time.time(),
        }
        try:
            self.queue.put_nowait(event)
            self.stats.published += 1
            self.stats.last_event_type = event_type
            self.stats.last_event_ts = event["stream_ts"]
        except asyncio.QueueFull:
            self.stats.dropped += 1
            logger.warning("stream event dropped because queue is full", extra={"event_type": event_type})

    async def _run(self) -> None:
        while self._running:
            event = await self.queue.get()
            await self.ws_manager.broadcast(event)
            for subscriber in list(self.subscribers):
                try:
                    await subscriber(event)
                except Exception:
                    logger.exception("stream subscriber failed")
            self.stats.delivered += 1
            self.queue.task_done()

    def health(self) -> Dict[str, Any]:
        return {
            "status": "ACTIVE" if self._running else "OFFLINE",
            "queue_depth": self.queue.qsize(),
            "published": self.stats.published,
            "delivered": self.stats.delivered,
            "dropped": self.stats.dropped,
            "last_event_type": self.stats.last_event_type,
            "last_event_ts": self.stats.last_event_ts,
            "websocket_clients": len(self.ws_manager.active_connections),
        }
