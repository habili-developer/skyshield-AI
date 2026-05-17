"""Preprocessing layer: align → normalize → filter → extract → validate."""

from __future__ import annotations

import time
from typing import Any, Dict, List

from backend.app.schemas.sensor_event import SENSOR_TYPES, SensorEvent, event_from_dict

MIN_CONFIDENCE = 0.35
POSITION_SENSORS = {"radar", "adsb"}


def align_timestamps(events: List[Dict[str, Any]], tick: int) -> List[Dict[str, Any]]:
    base_ts = time.time()
    aligned: List[Dict[str, Any]] = []
    for idx, event in enumerate(events):
        item = dict(event)
        item["timestamp"] = base_ts + (idx * 0.01)
        item.setdefault("tick", tick)
        aligned.append(item)
    return aligned


def normalize_event(event: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(event)
    sensor = str(normalized.get("sensor_type", "radar")).lower()
    if sensor not in SENSOR_TYPES:
        normalized["valid"] = False
        normalized["sensor_type"] = sensor
        return normalized

    normalized["sensor_type"] = sensor
    normalized["target_id"] = str(normalized.get("target_id", "UNKNOWN"))
    normalized["confidence"] = max(0.0, min(1.0, float(normalized.get("confidence", 0.5))))
    normalized["payload"] = dict(normalized.get("payload") or {})
    normalized.setdefault("event_id", f"{sensor}-{normalized['tick']}-{normalized['target_id']}")
    return normalized


def filter_noise(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    filtered: List[Dict[str, Any]] = []
    for event in events:
        if not event.get("valid", True):
            continue
        if event["confidence"] < MIN_CONFIDENCE:
            continue
        payload = event["payload"]
        if event["sensor_type"] in POSITION_SENSORS:
            if "lat" not in payload or "lon" not in payload:
                continue
        item = dict(event)
        item["noise_filtered"] = True
        filtered.append(item)
    return filtered


def extract_features(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched: List[Dict[str, Any]] = []
    for event in events:
        payload = dict(event["payload"])
        if event["sensor_type"] == "rf":
            payload.setdefault("rf_signature", "unknown")
            payload["anomalous_rf"] = payload.get("rf_signature") == "unknown"
        if event["sensor_type"] == "camera":
            payload.setdefault("camera_label", "unknown_object")
        if event["sensor_type"] == "acoustic":
            payload.setdefault("hovering", False)
        if event["sensor_type"] == "radar":
            payload.setdefault("maneuvering", False)
            payload.setdefault("speed_mps", 0.0)
        item = dict(event)
        item["payload"] = payload
        enriched.append(item)
    return enriched


def validate_events(events: List[Dict[str, Any]]) -> List[SensorEvent]:
    validated: List[SensorEvent] = []
    for event in events:
        try:
            model = event_from_dict({**event, "valid": True})
            validated.append(model)
        except Exception:
            continue
    return validated


def preprocess_sensor_events(raw_events: List[Dict[str, Any]], tick: int) -> List[Dict[str, Any]]:
    """Full preprocessing pipeline for one simulation tick."""
    aligned = align_timestamps(raw_events, tick)
    normalized = [normalize_event(e) for e in aligned]
    denoised = filter_noise(normalized)
    featured = extract_features(denoised)
    return [e.to_dict() for e in validate_events(featured)]
