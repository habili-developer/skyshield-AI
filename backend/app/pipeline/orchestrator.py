"""Operational pipeline: detect → preprocess → fuse → score → alert."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

from backend.app.fusion.engine import fuse_sensor_events
from backend.app.preprocessing.pipeline import preprocess_sensor_events
from backend.app.services.kalman import AirspaceKalmanFilter
from backend.app.threat.engine import build_alert, score_track

ALERT_LEVELS = {"yellow", "orange", "red"}


@dataclass
class PipelineResult:
    tick: int
    scenario: str
    ended: bool
    sensor_events: List[Dict[str, Any]]
    fused_tracks: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    timeline_entries: List[Dict[str, Any]]
    temporal_state: Dict[str, Any]
    sensor_feed: List[Dict[str, Any]]


def run_pipeline_step(
    *,
    tick: int,
    raw_sensor_events: List[Dict[str, Any]],
    scenario_label: str,
    ended: bool,
    history: Dict[str, List[Dict[str, Any]]],
    restricted_zone: Dict[str, Any],
    filters: Dict[str, AirspaceKalmanFilter],
    temporal_state: Dict[str, Any] | None = None,
) -> PipelineResult:
    temporal_state = temporal_state or {"targets": {}}
    preprocessed = preprocess_sensor_events(raw_sensor_events, tick)
    fused_tracks = fuse_sensor_events(preprocessed, history, restricted_zone, filters)

    enriched: List[Dict[str, Any]] = []
    alerts: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    sensor_feed: List[Dict[str, Any]] = []

    for track in fused_tracks:
        scoring = score_track(track, history=history, temporal_state=temporal_state)
        track.update(scoring)
        enriched.append(track)

        timeline.append(
            {
                "tick": tick,
                "target_id": track["target_id"],
                "event": "track_scored",
                "threat_level": track["threat_level"],
                "fusion_confidence": track.get("fusion_confidence"),
                "anomaly_score": track.get("anomaly", {}).get("anomaly_score"),
            }
        )

        anomaly = track.get("anomaly", {})
        if anomaly.get("anomaly_label") in {"suspicious", "high-risk"}:
            timeline.append(
                {
                    "tick": tick,
                    "target_id": track["target_id"],
                    "event": "anomaly_detected",
                    "anomaly_label": anomaly.get("anomaly_label"),
                    "anomaly_score": anomaly.get("anomaly_score"),
                }
            )
            sensor_feed.append(
                {
                    "tick": tick,
                    "type": "anomaly_trigger",
                    "target_id": track["target_id"],
                    "message": f"Anomaly {anomaly.get('anomaly_label')} ({anomaly.get('anomaly_score')})",
                    "timestamp": tick,
                }
            )

        if scoring["threat_level"] in ALERT_LEVELS:
            alert = build_alert(track)
            alerts.append(alert)
            timeline.append(
                {
                    "tick": tick,
                    "target_id": track["target_id"],
                    "event": "alert_raised",
                    "threat_level": track["threat_level"],
                    "title": alert["title"],
                }
            )
            sensor_feed.append(
                {
                    "tick": tick,
                    "type": "escalation",
                    "target_id": track["target_id"],
                    "message": f"Alert escalated to {track['threat_level'].upper()}",
                    "timestamp": tick,
                }
            )

        sensor_feed.append(
            {
                "tick": tick,
                "type": "track_update",
                "target_id": track["target_id"],
                "message": f"Track fused — {track['threat_level'].upper()} ({track['threat_score']})",
                "timestamp": tick,
            }
        )

    for event in preprocessed:
        timeline.append(
            {
                "tick": tick,
                "target_id": event["target_id"],
                "event": "sensor_detection",
                "sensor_type": event["sensor_type"],
                "confidence": event["confidence"],
            }
        )
        sensor_feed.append(
            {
                "tick": tick,
                "type": "detection",
                "target_id": event["target_id"],
                "sensor_type": event["sensor_type"],
                "message": f"{event['sensor_type'].upper()} detection @ {(event['confidence']*100):.0f}%",
                "timestamp": tick,
                "confidence": event["confidence"],
            }
        )

    return PipelineResult(
        tick=tick,
        scenario=scenario_label,
        ended=ended,
        sensor_events=preprocessed,
        fused_tracks=enriched,
        alerts=alerts,
        timeline_entries=timeline,
        temporal_state=temporal_state,
        sensor_feed=sensor_feed,
    )
