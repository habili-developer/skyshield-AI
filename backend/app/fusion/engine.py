"""Fusion engine: correlate multi-sensor evidence into unified tracks."""

from __future__ import annotations

import math
from typing import Any, Dict, List

import numpy as np

from backend.app.services.kalman import AirspaceKalmanFilter

SENSOR_WEIGHTS = {
    "adsb": 2.0,
    "radar": 1.2,
    "rf": 0.8,
    "camera": 0.6,
    "thermal": 0.5,
    "acoustic": 0.4,
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _position_from_events(grouped_events: List[Dict[str, Any]]) -> tuple[float, float, float, float]:
    weighted_lat, weighted_lon, weighted_alt, total_weight = 0.0, 0.0, 0.0, 0.0
    for event in grouped_events:
        weight = SENSOR_WEIGHTS.get(event["sensor_type"], 1.0) * event.get("confidence", 1.0)
        payload = event["payload"]
        if "lat" in payload and "lon" in payload:
            weighted_lat += payload["lat"] * weight
            weighted_lon += payload["lon"] * weight
            weighted_alt += payload.get("altitude_m", 0) * weight
            total_weight += weight

    if total_weight > 0:
        return weighted_lat / total_weight, weighted_lon / total_weight, weighted_alt / total_weight, total_weight

    coord_event = next((e for e in grouped_events if "lat" in e["payload"]), None)
    if coord_event:
        p = coord_event["payload"]
        return p["lat"], p["lon"], p.get("altitude_m", 0.0), 1.0
    return 0.0, 0.0, 0.0, 0.0


def _fusion_confidence(
    grouped_events: List[Dict[str, Any]],
    total_weight: float,
    conflicts: List[str],
) -> float:
    sensor_count = len({e["sensor_type"] for e in grouped_events})
    agreement_bonus = min(sensor_count * 0.08, 0.35)
    base = (total_weight / max(len(grouped_events), 1)) / 2.5
    confidence = min(0.98, base + agreement_bonus)
    confidence -= min(0.25, len(conflicts) * 0.08)
    return round(max(0.1, confidence), 3)


def _detect_conflicts(grouped_events: List[Dict[str, Any]]) -> List[str]:
    conflicts: List[str] = []
    has_adsb = any(e["sensor_type"] == "adsb" for e in grouped_events)
    rf_unknown = any(
        e["sensor_type"] == "rf" and e["payload"].get("rf_signature") == "unknown" for e in grouped_events
    )
    camera_unknown = any(
        e["sensor_type"] == "camera"
        and e["payload"].get("camera_label") in {"unknown_object", "small_uas", "unidentified_airframe"}
        for e in grouped_events
    )
    if has_adsb and rf_unknown:
        conflicts.append("identity_mismatch")
    if has_adsb and camera_unknown:
        conflicts.append("visual_identity_mismatch")
    low_conf = [e for e in grouped_events if e.get("confidence", 1) < 0.5]
    if len(low_conf) >= 2:
        conflicts.append("weak_signal_cluster")
    return conflicts


def fuse_sensor_events(
    events: List[Dict[str, Any]],
    history: Dict[str, List[Dict[str, Any]]],
    restricted_zone: Dict[str, Any],
    filters: Dict[str, AirspaceKalmanFilter],
) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for event in events:
        grouped.setdefault(event["target_id"], []).append(event)

    fused_tracks: List[Dict[str, Any]] = []
    zone_center = restricted_zone["center"]
    radius_km = restricted_zone["radius_km"]

    for target_id, grouped_events in grouped.items():
        conflicts = _detect_conflicts(grouped_events)
        avg_lat, avg_lon, avg_alt, total_weight = _position_from_events(grouped_events)

        if target_id not in filters:
            filters[target_id] = AirspaceKalmanFilter(np.array([avg_lat, avg_lon, avg_alt, 0.0, 0.0, 0.0]))

        kf = filters[target_id]
        kf.predict()
        kf.update(np.array([avg_lat, avg_lon, avg_alt]), sensor_weight=total_weight)
        state = kf.get_state_dict()
        lat, lon, altitude_m = state["lat"], state["lon"], state["altitude_m"]

        radar_event = next((e for e in grouped_events if e["sensor_type"] == "radar"), None)
        adsb_event = next((e for e in grouped_events if e["sensor_type"] == "adsb"), None)
        rf_event = next((e for e in grouped_events if e["sensor_type"] == "rf"), None)
        camera_event = next((e for e in grouped_events if e["sensor_type"] == "camera"), None)
        acoustic_event = next((e for e in grouped_events if e["sensor_type"] == "acoustic"), None)
        thermal_event = next((e for e in grouped_events if e["sensor_type"] == "thermal"), None)

        ref = radar_event or adsb_event or grouped_events[0]
        heading_deg = ref["payload"].get("heading_deg", 0.0)
        speed_mps = ref["payload"].get("speed_mps", 0.0)

        prev_items = history.get(target_id, [])
        previous = prev_items[-1] if prev_items else None
        heading_delta = 0.0
        if previous:
            heading_delta = abs(heading_deg - float(previous.get("heading_deg", heading_deg)))
            if heading_delta > 180:
                heading_delta = 360 - heading_delta

        distance_to_zone_km = haversine_km(lat, lon, zone_center["lat"], zone_center["lon"])
        in_zone = distance_to_zone_km <= radius_km
        fusion_confidence = _fusion_confidence(grouped_events, total_weight, conflicts)

        fused_tracks.append(
            {
                "target_id": target_id,
                "tick": grouped_events[0]["tick"],
                "position": {
                    "lat": lat,
                    "lon": lon,
                    "altitude_m": altitude_m,
                    "heading_deg": heading_deg,
                    "speed_mps": speed_mps,
                },
                "source_sensors": [e["sensor_type"] for e in grouped_events],
                "fusion_confidence": fusion_confidence,
                "evidence": {
                    "sensor_weight": round(total_weight, 3),
                    "sensor_conflicts": conflicts,
                    "transponder_present": adsb_event is not None,
                    "rf_signature": rf_event["payload"].get("rf_signature", "unknown") if rf_event else "unknown",
                    "camera_label": camera_event["payload"].get("camera_label", "unknown") if camera_event else "unknown",
                    "thermal_score": thermal_event["payload"].get("thermal_score", 0.0) if thermal_event else 0.0,
                    "hovering": bool(acoustic_event["payload"].get("hovering", False)) if acoustic_event else False,
                    "maneuvering": bool(radar_event["payload"].get("maneuvering", False)) if radar_event else False,
                    "heading_delta_deg": heading_delta,
                    "distance_to_zone_km": round(distance_to_zone_km, 3),
                    "in_restricted_zone": in_zone,
                },
            }
        )

    return fused_tracks
