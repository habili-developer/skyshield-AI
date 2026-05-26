
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List


class InMemoryStore:
    def __init__(self) -> None:
        self.reset("normal", {"center": {"lat": 0.0, "lon": 0.0}, "radius_km": 1.0})

    def reset(self, scenario: str, restricted_zone: Dict[str, Any]) -> None:
        self.state: Dict[str, Any] = {
            "scenario": scenario,
            "tick": 0,
            "ended": False,
            "restricted_zone": restricted_zone,
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

    def apply_step(
        self,
        tick: int,
        sensor_events: List[Dict[str, Any]],
        fused_tracks: List[Dict[str, Any]],
        alerts: List[Dict[str, Any]],
        ended: bool,
    ) -> None:
        self.state["tick"] = tick
        self.state["ended"] = ended
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

    def snapshot(self) -> Dict[str, Any]:
        return deepcopy(self.state)

    def latest_alert(self) -> Dict[str, Any] | None:
        alerts = self.state.get("alerts", [])
        return alerts[-1] if alerts else None
