"""OpenSky Network live aircraft state-vector connector."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any, AsyncIterator, Dict, Iterable, List

import httpx

from backend.app.geospatial.engine import GeospatialEngine
from backend.app.livefeeds.base import LiveFeedAdapter


OPEN_SKY_STATES_URL = "https://opensky-network.org/api/states/all"


class OpenSkyLiveFeed(LiveFeedAdapter):
    feed_type = "adsb_opensky"

    def __init__(
        self,
        geospatial: GeospatialEngine,
        enabled: bool = False,
        poll_seconds: float = 15.0,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        super().__init__(name="opensky", enabled=enabled)
        self.geospatial = geospatial
        self.poll_seconds = max(5.0, poll_seconds)
        self.username = username or os.getenv("OPENSKY_USERNAME")
        self.password = password or os.getenv("OPENSKY_PASSWORD")

    def _bbox(self) -> Dict[str, float]:
        center = self.geospatial.region.map_center
        radius = float(self.geospatial.region.operational_radius_km)
        lat_delta = radius / 111.0
        lon_delta = radius / max(30.0, 111.0)
        return {
            "lamin": center["lat"] - lat_delta,
            "lomin": center["lon"] - lon_delta,
            "lamax": center["lat"] + lat_delta,
            "lomax": center["lon"] + lon_delta,
        }

    async def events(self) -> AsyncIterator[Dict[str, Any]]:
        auth = (self.username, self.password) if self.username and self.password else None
        async with httpx.AsyncClient(timeout=12, auth=auth) as client:
            while self.enabled:
                try:
                    response = await client.get(OPEN_SKY_STATES_URL, params=self._bbox())
                    response.raise_for_status()
                    payload = response.json()
                    for event in self._normalize_states(payload.get("states") or [], payload.get("time")):
                        self.mark_event()
                        yield event
                    await asyncio.sleep(self.poll_seconds)
                except Exception as exc:
                    self.mark_error(exc)
                    await asyncio.sleep(min(self.poll_seconds * 2, 60))

    def _normalize_states(self, states: Iterable[List[Any]], batch_time: int | None) -> Iterable[Dict[str, Any]]:
        for row in states:
            if len(row) < 17:
                continue
            lat = row[6]
            lon = row[5]
            if lat is None or lon is None:
                continue
            callsign = (row[1] or "").strip()
            icao24 = row[0] or "unknown"
            geo = self.geospatial.evaluate_position(float(lat), float(lon))
            yield {
                "event_id": f"opensky-{icao24}-{batch_time or int(time.time())}",
                "source": "opensky",
                "target_id": f"OS-{str(icao24).upper()}",
                "callsign": callsign or None,
                "sensor_type": "adsb",
                "timestamp": batch_time or time.time(),
                "lat": float(lat),
                "lon": float(lon),
                "altitude_m": row[7] if row[7] is not None else row[13],
                "speed_mps": row[9] or 0,
                "heading_deg": row[10] or 0,
                "vertical_rate": row[11],
                "confidence": 0.82,
                "on_ground": bool(row[8]),
                "geo": geo,
                "message": f"OpenSky ADS-B state vector {callsign or icao24}",
            }
