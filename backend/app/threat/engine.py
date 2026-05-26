"""Threat engine: rule scoring + anomaly + temporal escalation + explainability."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from backend.app.ai.anomaly.engine import detect_anomaly
from backend.app.explainability.trace import build_evidence_summary, build_explanation_trace
from backend.app.threat.temporal import apply_temporal_escalation

THREAT_LEVELS = ("green", "yellow", "orange", "red")

LEVEL_META = {
    "red": (
        "CRITICAL: Restricted zone intrusion",
        "Escalate to senior operator, maintain continuous multi-sensor tracking, and notify site security per protocol.",
    ),
    "orange": (
        "HIGH: Suspicious airspace activity",
        "Increase monitoring priority, correlate all sensors, and prepare operator briefing.",
    ),
    "yellow": (
        "CAUTION: Unknown contact",
        "Continue observation and correlate evidence across all sensors.",
    ),
    "green": (
        "Routine: Authorized or low-risk traffic",
        "Maintain background monitoring.",
    ),
}


def classify_track(track: Dict[str, Any]) -> str:
    evidence = track["evidence"]
    if evidence["transponder_present"] and evidence["rf_signature"] == "known" and evidence["camera_label"] in {
        "authorized_aircraft",
        "helicopter",
    }:
        return "authorized"
    if not evidence["transponder_present"] and evidence["rf_signature"] == "unknown":
        return "unknown"
    return "suspicious"


def _rule_score(track: Dict[str, Any]) -> Tuple[int, List[Tuple[str, int]], List[str]]:
    evidence = track["evidence"]
    position = track["position"]
    score = 0
    point_trace: List[Tuple[str, int]] = []
    narrative: List[str] = []

    def bump(label: str, points: int, note: str) -> None:
        nonlocal score
        score += points
        point_trace.append((label, points))
        narrative.append(note)

    if evidence["in_restricted_zone"]:
        bump("Restricted-zone entry", 55, "Target has entered the restricted monitoring zone.")
    elif evidence["distance_to_zone_km"] <= 1.0:
        bump("Restricted-zone approach", 35, "Target is in immediate proximity to the restricted zone.")
    elif evidence["distance_to_zone_km"] <= 2.5:
        bump("Zone proximity", 20, "Target is approaching the restricted zone.")

    if not evidence["transponder_present"]:
        bump("Missing ADS-B", 20, "No cooperative identity signal (ADS-B) observed.")
    if evidence["rf_signature"] == "unknown":
        bump("RF anomaly", 18, "Unidentified RF signature detected.")
    if evidence["camera_label"] in {"unknown_object", "small_uas", "unidentified_airframe"}:
        bump("Unknown visual class", 10, "Camera classification is unknown or non-cooperative.")
    if evidence["hovering"]:
        bump("Loitering behavior", 10, "Object is hovering in the monitored airspace.")
    if evidence["maneuvering"] or evidence["heading_delta_deg"] >= 40:
        bump("Unusual maneuvering", 12, "Unusual maneuvering behavior detected.")
    if position["altitude_m"] < 150:
        bump("Low altitude", 8, "Object is flying at low altitude.")
    if position["speed_mps"] < 8 and not evidence["transponder_present"]:
        bump("Slow loitering pattern", 10, "Slow loitering pattern with no identity signal.")

    conflicts = evidence.get("sensor_conflicts") or []
    fusion_bonus = 0
    sensor_weight = evidence.get("sensor_weight", 1.0)
    fusion_confidence = track.get("fusion_confidence", 0.5)
    decay_note = None

    if conflicts:
        score = int(score * 0.92)
        decay_note = f"Sensor conflicts adjusted score: {', '.join(conflicts)}"
        narrative.append(decay_note)

    if sensor_weight < 1.5 or fusion_confidence < 0.45:
        score = int(score * 0.75)
        narrative.append("Lower multi-sensor confidence; score adjusted to reduce false alarms.")
    elif sensor_weight > 3.0 and fusion_confidence > 0.7:
        fusion_bonus = 10
        score = min(score + fusion_bonus, 100)
        point_trace.append(("Multi-sensor correlation", fusion_bonus))
        narrative.append("Strong multi-sensor agreement increases monitoring confidence.")

    sensor_bonus = min(len(track["source_sensors"]) * 2, 10)
    if sensor_bonus:
        score += sensor_bonus
        point_trace.append(("Sensor diversity", sensor_bonus))

    score = min(score, 100)
    return score, point_trace, narrative, fusion_bonus, decay_note


def score_track(
    track: Dict[str, Any],
    history: Dict[str, List[Dict[str, Any]]] | None = None,
    temporal_state: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    history = history or {}
    temporal_state = temporal_state or {"targets": {}}

    rule_score, point_trace, narrative, fusion_bonus, decay_note = _rule_score(track)

    anomaly = detect_anomaly(track, history)
    track["anomaly"] = anomaly
    anomaly_bonus = 0
    if anomaly["anomaly_label"] == "suspicious":
        anomaly_bonus = int(8 + anomaly["anomaly_score"] * 12)
    elif anomaly["anomaly_label"] == "high-risk":
        anomaly_bonus = int(15 + anomaly["anomaly_score"] * 18)
    rule_score = min(100, rule_score + anomaly_bonus)

    base_level = _score_to_level(rule_score)
    temporal = apply_temporal_escalation(
        track["target_id"],
        rule_score,
        base_level,
        int(track.get("tick", 0)),
        temporal_state,
    )

    final_score = temporal["threat_score"]
    final_level = temporal["threat_level"]
    title, action = LEVEL_META[final_level]

    explanation_trace = build_explanation_trace(
        track,
        rule_points=point_trace,
        anomaly_bonus=anomaly_bonus,
        temporal_bonus=temporal["temporal_bonus"],
        fusion_bonus=fusion_bonus,
        decay_note=decay_note,
    )

    return {
        "classification": classify_track(track),
        "threat_score": final_score,
        "threat_level": final_level,
        "title": title,
        "recommended_action": action,
        "explanation": " ".join(narrative) if narrative else "No elevated risk indicators detected.",
        "explanation_trace": explanation_trace,
        "evidence_summary": build_evidence_summary(track),
        "anomaly": anomaly,
        "confidence_evolution": temporal["confidence_evolution"],
        "rule_score": rule_score,
    }


def _score_to_level(score: int) -> str:
    if score >= 70:
        return "red"
    if score >= 50:
        return "orange"
    if score >= 25:
        return "yellow"
    return "green"


def build_alert(track: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "alert_id": f"alert-{track['tick']}-{track['target_id']}",
        "tick": track["tick"],
        "target_id": track["target_id"],
        "level": track["threat_level"],
        "score": track["threat_score"],
        "title": track["title"],
        "explanation": track["explanation"],
        "explanation_trace": track.get("explanation_trace", []),
        "recommended_action": track["recommended_action"],
        "fusion_confidence": track.get("fusion_confidence"),
        "anomaly": track.get("anomaly"),
    }
