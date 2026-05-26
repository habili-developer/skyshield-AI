"""Lifecycle manager for public live-feed adapters."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import Any, Dict, List

from backend.app.livefeeds.base import LiveFeedAdapter
from backend.app.streaming import StreamHub


logger = logging.getLogger("skyshield.livefeeds")


class LiveFeedManager:
    def __init__(self, stream_hub: StreamHub) -> None:
        self.stream_hub = stream_hub
        self.adapters: Dict[str, LiveFeedAdapter] = {}
        self.tasks: Dict[str, asyncio.Task] = {}
        self.started_at: float | None = None
        self.total_events = 0

    def register(self, adapter: LiveFeedAdapter) -> None:
        self.adapters[adapter.name] = adapter

    async def start(self) -> None:
        self.started_at = self.started_at or time.time()
        for name, adapter in self.adapters.items():
            if adapter.enabled and name not in self.tasks:
                self.tasks[name] = asyncio.create_task(self._run(adapter), name=f"livefeed-{name}")
        logger.info("live feed manager started", extra={"enabled": list(self.tasks)})

    async def stop(self) -> None:
        for task in self.tasks.values():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self.tasks.clear()

    async def enable(self, name: str) -> Dict[str, Any]:
        adapter = self.adapters[name]
        adapter.enabled = True
        adapter.status.enabled = True
        if name not in self.tasks:
            self.tasks[name] = asyncio.create_task(self._run(adapter), name=f"livefeed-{name}")
        return adapter.health()

    async def disable(self, name: str) -> Dict[str, Any]:
        adapter = self.adapters[name]
        adapter.enabled = False
        adapter.status.enabled = False
        task = self.tasks.pop(name, None)
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        return adapter.health()

    async def _run(self, adapter: LiveFeedAdapter) -> None:
        async for event in adapter.events():
            self.total_events += 1
            await self.stream_hub.publish("livefeed_event", event)

    def health(self) -> Dict[str, Any]:
        uptime = time.time() - self.started_at if self.started_at else 0
        events_per_second = round(self.total_events / uptime, 3) if uptime > 0 else 0
        return {
            "status": "ACTIVE" if self.tasks else "ONLINE",
            "uptime_seconds": round(uptime, 1),
            "events_total": self.total_events,
            "events_per_second": events_per_second,
            "feeds": {name: adapter.health() for name, adapter in self.adapters.items()},
        }
