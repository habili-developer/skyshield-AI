"""System health aggregation for operations dashboard."""

from __future__ import annotations

from typing import Any, Dict, List

from backend.app.ai.anomaly.engine import SKLEARN_AVAILABLE
from backend.app.config import settings


def build_system_health(services: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = services["store"].snapshot()
    tick = snapshot.get("tick", 0)
    tracks = snapshot.get("latest_tracks", [])

    sensors_active = set()
    for event in snapshot.get("recent_sensor_events", [])[-30:]:
        sensors_active.add(event.get("sensor_type"))

    all_sensors = ["radar", "rf", "camera", "thermal", "acoustic", "adsb"]

    def sensor_status(name: str) -> str:
        if name in sensors_active:
            return "ACTIVE"
        if tick > 0:
            return "DEGRADED"
        return "ONLINE"

    components: List[Dict[str, str]] = [
        {"name": "Backend API", "status": "ONLINE"},
        {"name": "Fusion Engine", "status": "ACTIVE" if tracks else "ONLINE"},
        {"name": "Threat Engine", "status": "ACTIVE" if tracks else "ONLINE"},
        {"name": "Anomaly Engine", "status": "ACTIVE" if SKLEARN_AVAILABLE else "DEGRADED"},
        {
            "name": "Streaming Engine",
            "status": services.get("stream_hub").health()["status"] if services.get("stream_hub") else "OFFLINE",
        },
        {
            "name": "Ingestion Layer",
            "status": services.get("ingestion").health()["status"] if services.get("ingestion") else "OFFLINE",
        },
        {
            "name": "LLM Copilot",
            "status": "ONLINE" if settings.llm_provider == "mock" else "ACTIVE",
        },
    ]

    return {
        "overall": "OPERATIONAL",
        "sensors": [
            {"name": s.upper(), "status": sensor_status(s)} for s in all_sensors
        ],
        "components": components,
        "tick": tick,
        "scenario": snapshot.get("scenario", "normal"),
        "mode": services.get("mode", settings.operational_mode),
    }
