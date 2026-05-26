"""Backward-compatible re-export of the fusion engine."""

from backend.app.fusion.engine import fuse_sensor_events, haversine_km

__all__ = ["fuse_sensor_events", "haversine_km"]
