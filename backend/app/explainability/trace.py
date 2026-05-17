"""Transparent reasoning traces for threat scoring."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _add(trace: List[str], label: str, points: int) -> int:
    if points <= 0:
        return 0
    trace.append(f"{label} (+{points})")
    return points


def build_explanation_trace(
    track: Dict[str, Any],
    *,
    rule_points: List[Tuple[str, int]],
    anomaly_bonus: int,
    temporal_bonus: int,
    fusion_bonus: int,
    decay_note: str | None = None,
) -> List[str]:
    trace: List[str] = []
    for label, points in rule_points:
        _add(trace, label, points)
    if anomaly_bonus > 0:
        anomaly = track.get("anomaly", {})
        _add(trace, f"AI anomaly ({anomaly.get('anomaly_label', 'suspicious')})", anomaly_bonus)
    if temporal_bonus > 0:
        _add(trace, "Persistent suspicious tracking", temporal_bonus)
    if fusion_bonus > 0:
        sensors = ", ".join(track.get("source_sensors", []))
        _add(trace, f"Multi-sensor agreement ({sensors})", fusion_bonus)
    if decay_note:
        trace.append(decay_note)
    return trace


def build_evidence_summary(track: Dict[str, Any]) -> Dict[str, Any]:
    evidence = track.get("evidence", {})
    return {
        "sensors_agreed": track.get("source_sensors", []),
        "sensor_conflicts": evidence.get("sensor_conflicts", []),
        "fusion_confidence": track.get("fusion_confidence"),
        "transponder_present": evidence.get("transponder_present"),
        "rf_signature": evidence.get("rf_signature"),
        "camera_label": evidence.get("camera_label"),
        "in_restricted_zone": evidence.get("in_restricted_zone"),
        "distance_to_zone_km": evidence.get("distance_to_zone_km"),
        "anomaly": track.get("anomaly"),
    }


def format_trace_for_llm(track: Dict[str, Any]) -> str:
    lines = track.get("explanation_trace") or []
    if not lines:
        return track.get("explanation", "No trace available.")
    return "Reasoning trace:\n- " + "\n- ".join(lines)
