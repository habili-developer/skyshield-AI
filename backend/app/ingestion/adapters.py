"""Professionally structured ingestion adapters.

Connectors are intentionally defensive and monitoring-only. They normalize external
observations into the same sensor-event shape used by the existing pipeline.
"""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Dict, Iterable, Optional

import httpx


class IngestionAdapter(ABC):
    source_type = "generic"

    def __init__(self, name: str, enabled: bool = False) -> None:
        self.name = name
        self.enabled = enabled

    @abstractmethod
    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        yield {}

    def normalize(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        now = time.time()
        return {
            "event_id": payload.get("event_id") or f"{self.name}-{int(now * 1000)}",
            "target_id": payload.get("target_id") or payload.get("icao24") or "UNKNOWN",
            "sensor_type": payload.get("sensor_type", self.source_type),
            "timestamp": payload.get("timestamp", now),
            "lat": payload.get("lat") or payload.get("latitude"),
            "lon": payload.get("lon") or payload.get("longitude"),
            "altitude_m": payload.get("altitude_m") or payload.get("altitude"),
            "speed_mps": payload.get("speed_mps") or payload.get("velocity"),
            "heading_deg": payload.get("heading_deg") or payload.get("heading"),
            "confidence": float(payload.get("confidence", 0.75)),
            "raw": payload,
        }


class RestIngestionAdapter(IngestionAdapter):
    source_type = "rest"

    def __init__(self, name: str, url: str, interval_seconds: float = 2.0, enabled: bool = False) -> None:
        super().__init__(name=name, enabled=enabled)
        self.url = url
        self.interval_seconds = interval_seconds

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=10) as client:
            while self.enabled:
                response = await client.get(self.url)
                response.raise_for_status()
                payload = response.json()
                rows: Iterable[Dict[str, Any]] = payload if isinstance(payload, list) else payload.get("events", [])
                for row in rows:
                    yield self.normalize(row)
                await asyncio.sleep(self.interval_seconds)


class WebSocketIngestionAdapter(IngestionAdapter):
    source_type = "websocket"

    def __init__(self, name: str, url: str, enabled: bool = False) -> None:
        super().__init__(name=name, enabled=enabled)
        self.url = url

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        try:
            import websockets
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("websockets package is required for WebSocket ingestion") from exc

        async with websockets.connect(self.url) as websocket:
            while self.enabled:
                payload = await websocket.recv()
                yield self.normalize({"payload": payload, "sensor_type": self.source_type})


class ADSBIngestionAdapter(RestIngestionAdapter):
    source_type = "adsb"


class RFIngestionAdapter(IngestionAdapter):
    source_type = "rf"

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        while self.enabled:
            await asyncio.sleep(1)
            continue
            yield {}


class CameraDetectionAdapter(IngestionAdapter):
    source_type = "camera"

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        while self.enabled:
            await asyncio.sleep(1)
            continue
            yield {}


class GPSStreamAdapter(WebSocketIngestionAdapter):
    source_type = "gps"


class TelemetryStreamAdapter(WebSocketIngestionAdapter):
    source_type = "telemetry"
