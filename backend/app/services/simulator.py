from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


class ScenarioLibrary:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.data = json.loads(self.path.read_text(encoding="utf-8"))
        self.restricted_zone = self.data["restricted_zone"]
        self.scenarios = self.data["scenarios"]

    def list_scenarios(self) -> List[str]:
        return list(self.scenarios.keys())

    def get_scenario(self, name: str) -> Dict[str, Any]:
        if name not in self.scenarios:
            raise KeyError(f"Unknown scenario: {name}")
        return self.scenarios[name]

    def step(self, scenario_name: str, tick: int) -> Tuple[List[Dict[str, Any]], bool, str]:
        scenario = self.get_scenario(scenario_name)
        frames = scenario["frames"]
        if tick < 1:
            tick = 1
        idx = tick - 1
        
        # Loop protection and dynamic pathing
        if idx >= len(frames):
            return [], True, scenario_name
            
        frame = frames[idx]
        current_scenario_display = scenario_name
        
        if scenario_name == "restricted_intrusion":
            frame = self._adjust_intrusion_path(tick, frame)
            if tick >= 4:
                current_scenario_display = "restricted_intrusion_escalation"
            
        sensor_events = self._frame_to_sensor_events(tick=tick, frame=frame)
        ended = idx >= len(frames) - 1
        return sensor_events, ended, current_scenario_display

    def _adjust_intrusion_path(self, tick: int, frame: Dict[str, Any]) -> Dict[str, Any]:
        """Move intrusion target from outside the zone toward the restricted center."""
        import copy

        new_frame = copy.deepcopy(frame)
        zone_center = self.restricted_zone["center"]
        zone_radius = self.restricted_zone.get("radius_km", 1.2)
        start_distance_km = max(zone_radius * 2.5, 2.0)
        total_frames = 5
        progress = (tick - 1) / (total_frames - 1) if total_frames > 1 else 1.0

        for target in new_frame.get("targets", []):
            if target["id"] != "INTR-RED":
                continue
            lon_offset = start_distance_km * 0.009 * (1 - progress)
            target["lat"] = zone_center["lat"] + 0.015
            target["lon"] = zone_center["lon"] - lon_offset
            target["speed_mps"] = max(12, 28 * (1 - progress * 0.6))
            target["maneuvering"] = progress > 0.4
            target["hovering"] = tick >= total_frames
            if tick >= total_frames:
                target["lat"] = zone_center["lat"]
                target["lon"] = zone_center["lon"]
                target["speed_mps"] = 3
        return new_frame

    def _frame_to_sensor_events(self, tick: int, frame: Dict[str, Any]) -> List[Dict[str, Any]]:
        events: List[Dict[str, Any]] = []
        for target in frame.get("targets", []):
            target_id = target["id"]
            lat = target["lat"]
            lon = target["lon"]
            altitude_m = target["altitude_m"]
            heading_deg = target["heading_deg"]
            speed_mps = target["speed_mps"]
            transponder = target.get("transponder", False)
            rf_signature = target.get("rf_signature", "unknown")
            camera_label = target.get("camera_label", "unknown_object")
            thermal = float(target.get("thermal", 0.6))
            hovering = bool(target.get("hovering", False))
            maneuvering = bool(target.get("maneuvering", False))
            acoustic_intensity = float(target.get("acoustic_intensity", 0.55))
            
            # Filter sensors based on what's enabled for this frame
            enabled_sensors = target.get("sensors", ["radar", "rf", "camera", "thermal", "acoustic", "adsb"])

            base_position = {
                "lat": lat,
                "lon": lon,
                "altitude_m": altitude_m,
                "heading_deg": heading_deg,
                "speed_mps": speed_mps,
            }

            if "radar" in enabled_sensors:
                events.append({
                    "event_id": f"radar-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "radar",
                    "target_id": target_id,
                    "confidence": 0.91,
                    "payload": {
                        **base_position,
                        "radial_velocity_mps": speed_mps,
                        "maneuvering": maneuvering,
                    },
                })
            
            if "rf" in enabled_sensors:
                events.append({
                    "event_id": f"rf-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "rf",
                    "target_id": target_id,
                    "confidence": 0.81 if rf_signature == "known" else 0.89,
                    "payload": {
                        "rf_signature": rf_signature,
                        "signal_strength": 0.65 if rf_signature == "known" else 0.87,
                    },
                })
            
            if "camera" in enabled_sensors:
                events.append({
                    "event_id": f"camera-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "camera",
                    "target_id": target_id,
                    "confidence": 0.82,
                    "payload": {
                        "camera_label": camera_label,
                        "shape_confidence": 0.84,
                    },
                })
            
            if "thermal" in enabled_sensors:
                events.append({
                    "event_id": f"thermal-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "thermal",
                    "target_id": target_id,
                    "confidence": 0.78,
                    "payload": {
                        "thermal_score": thermal,
                        "heat_profile": "consistent" if thermal > 0.65 else "weak",
                    },
                })
            
            if "acoustic" in enabled_sensors:
                events.append({
                    "event_id": f"acoustic-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "acoustic",
                    "target_id": target_id,
                    "confidence": 0.77,
                    "payload": {
                        "acoustic_intensity": acoustic_intensity,
                        "hovering": hovering,
                        "propeller_pattern": "stable" if hovering else "transit",
                    },
                })
            
            if "adsb" in enabled_sensors and transponder:
                events.append({
                    "event_id": f"adsb-{tick}-{target_id}",
                    "tick": tick,
                    "sensor_type": "adsb",
                    "target_id": target_id,
                    "confidence": 0.97,
                    "payload": {
                        **base_position,
                        "icao": f"SIM{abs(hash(target_id)) % 9999:04d}",
                        "callsign": target.get("callsign", target_id),
                    },
                })
        return events
