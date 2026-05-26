"""Ingestion lifecycle manager for operational mode."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Any, Dict, List

from backend.app.ingestion.adapters import IngestionAdapter
from backend.app.streaming import StreamHub


logger = logging.getLogger("skyshield.ingestion")


class IngestionManager:
    def __init__(self, stream_hub: StreamHub) -> None:
        self.stream_hub = stream_hub
        self.adapters: List[IngestionAdapter] = []
        self.tasks: List[asyncio.Task] = []
        self.events_received = 0

    def register(self, adapter: IngestionAdapter) -> None:
        self.adapters.append(adapter)

    async def start(self) -> None:
        for adapter in self.adapters:
            if adapter.enabled:
                self.tasks.append(asyncio.create_task(self._run_adapter(adapter), name=f"ingest-{adapter.name}"))
        logger.info("ingestion manager started", extra={"enabled_adapters": len(self.tasks)})

    async def stop(self) -> None:
        for task in self.tasks:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self.tasks.clear()

    async def _run_adapter(self, adapter: IngestionAdapter) -> None:
        async for event in adapter.events():
            self.events_received += 1
            await self.stream_hub.publish("sensor_ingested", event)

    def health(self) -> Dict[str, Any]:
        return {
            "status": "ACTIVE" if self.tasks else "ONLINE",
            "registered_adapters": [adapter.name for adapter in self.adapters],
            "enabled_adapters": [adapter.name for adapter in self.adapters if adapter.enabled],
            "events_received": self.events_received,
        }
