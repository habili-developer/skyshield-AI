from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db import SessionLocal, engine
from backend.app.models.db_models import Base, StoreSnapshot


class SqliteStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        Base.metadata.create_all(bind=engine)
        self.state = self._load_snapshot() or self._default_state()

    def _default_state(self) -> Dict[str, Any]:
        return {
            "scenario": "normal",
            "tick": 0,
            "ended": False,
            "restricted_zone": {"center": {"lat": 0.0, "lon": 0.0}, "radius_km": 1.0},
            "recent_sensor_events": [],
            "latest_tracks": [],
            "alerts": [],
            "history": {},
            "event_timeline": [],
            "operator_logs": [],
            "sensor_feed": [],
            "temporal_state": {"targets": {}},
            "system_health": {},
            "latest_summary": "",
        }

    def _load_snapshot(self) -> Optional[Dict[str, Any]]:
        try:
            with SessionLocal() as session:
                snapshot = session.get(StoreSnapshot, "latest_snapshot")
                if snapshot is None:
                    return None
                return json.loads(snapshot.value)
        except (SQLAlchemyError, json.JSONDecodeError):
            return None

    def _persist_snapshot(self) -> None:
        value = json.dumps(self.state, default=str)
        try:
            with SessionLocal() as session:
                snapshot = session.get(StoreSnapshot, "latest_snapshot")
                if snapshot is None:
                    snapshot = StoreSnapshot(key="latest_snapshot", value=value)
                    session.add(snapshot)
                else:
                    snapshot.value = value
                session.commit()
        except SQLAlchemyError as exc:
            raise RuntimeError("Failed to persist store snapshot") from exc

    def reset(self, scenario: str, restricted_zone: Dict[str, Any]) -> None:
        self.state = self._default_state()
        self.state["scenario"] = scenario
        self.state["restricted_zone"] = restricted_zone
        self._persist_snapshot()

    def apply_step(
        self,
        tick: int,
        sensor_events: List[Dict[str, Any]],
        fused_tracks: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
        ended: bool,
        timeline_entries: List[Dict[str, Any]] | None = None,
        scenario: str | None = None,
        temporal_state: Dict[str, Any] | None = None,
        sensor_feed: List[Dict[str, Any]] | None = None,
        system_health: Dict[str, Any] | None = None,
    ) -> None:
        self.state["tick"] = tick
        self.state["ended"] = ended
        if scenario:
            self.state["scenario"] = scenario
        self.state["recent_sensor_events"] = (self.state["recent_sensor_events"] + sensor_events)[-200:]
        self.state["latest_tracks"] = fused_tracks
        self.state["alerts"] = (self.state["alerts"] + alerts)[-100:]
        for track in fused_tracks:
            target_id = track["target_id"]
            history = self.state["history"].setdefault(target_id, [])
            history.append(
                {
                    "tick": tick,
                    "lat": track["position"]["lat"],
                    "lon": track["position"]["lon"],
                    "altitude_m": track["position"]["altitude_m"],
                    "heading_deg": track["position"]["heading_deg"],
                    "speed_mps": track["position"]["speed_mps"],
                    "threat_score": track["threat_score"],
                    "threat_level": track["threat_level"],
                }
            )
            self.state["history"][target_id] = history[-50:]
        if timeline_entries:
            self.state["event_timeline"] = (self.state.get("event_timeline", []) + timeline_entries)[-300:]
        if temporal_state is not None:
            self.state["temporal_state"] = temporal_state
        if sensor_feed:
            self.state["sensor_feed"] = (self.state.get("sensor_feed", []) + sensor_feed)[-150:]
        if system_health:
            self.state["system_health"] = system_health
        for alert in alerts:
            self.state.setdefault("operator_logs", []).append(
                {
                    "tick": tick,
                    "type": "alert",
                    "level": alert.get("level", "yellow"),
                    "message": alert.get("title") or alert.get("message", "Alert"),
                    "target_id": alert.get("target_id"),
                }
            )
            self.state["operator_logs"] = self.state["operator_logs"][-200:]
        self._persist_snapshot()

    def snapshot(self) -> Dict[str, Any]:
        return deepcopy(self.state)

    def latest_alert(self) -> Optional[Dict[str, Any]]:
        alerts = self.state.get("alerts", [])
        return alerts[-1] if alerts else None

    def append_live_event(self, event: Dict[str, Any]) -> None:
        feed_event = {
            "tick": self.state.get("tick", 0),
            "type": event.get("type", event.get("source", "livefeed")),
            "target_id": event.get("target_id"),
            "sensor_type": event.get("sensor_type"),
            "message": event.get("message", "Live feed event received"),
            "timestamp": event.get("timestamp"),
            "confidence": event.get("confidence"),
            "severity": event.get("severity", "info"),
        }
        self.state["sensor_feed"] = (self.state.get("sensor_feed", []) + [feed_event])[-200:]
        self.state["event_timeline"] = (
            self.state.get("event_timeline", [])
            + [
                {
                    "tick": self.state.get("tick", 0),
                    "target_id": event.get("target_id"),
                    "event": "livefeed_update",
                    "sensor_type": event.get("sensor_type"),
                    "source": event.get("source"),
                }
            ]
        )[-400:]
        self._persist_snapshot()

    def close(self) -> None:
        engine.dispose()
