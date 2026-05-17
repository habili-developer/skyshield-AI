"""Weather overlay connector using public Open-Meteo forecast/current data."""

from __future__ import annotations

import asyncio
import time
from typing import Any, AsyncIterator, Dict

import httpx

from backend.app.geospatial.engine import GeospatialEngine
from backend.app.livefeeds.base import LiveFeedAdapter


class WeatherOverlayFeed(LiveFeedAdapter):
    feed_type = "weather_overlay"

    def __init__(self, geospatial: GeospatialEngine, enabled: bool = False, poll_seconds: float = 120.0) -> None:
        super().__init__(name="weather-overlay", enabled=enabled)
        self.geospatial = geospatial
        self.poll_seconds = max(60.0, poll_seconds)

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        center = self.geospatial.region.map_center
        params = {
            "latitude": center["lat"],
            "longitude": center["lon"],
            "current": "temperature_2m,wind_speed_10m,wind_direction_10m,visibility",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            while self.enabled:
                try:
                    response = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
                    response.raise_for_status()
                    payload = response.json()
                    self.mark_event()
                    yield {
                        "event_id": f"weather-{int(time.time())}",
                        "source": "open-meteo",
                        "sensor_type": "weather",
                        "target_id": "REGION-WEATHER",
                        "timestamp": time.time(),
                        "confidence": 0.9,
                        "message": "Weather overlay updated",
                        "weather": payload.get("current", {}),
                    }
                    await asyncio.sleep(self.poll_seconds)
                except Exception as exc:
                    self.mark_error(exc)
                    await asyncio.sleep(min(self.poll_seconds * 2, 300))
