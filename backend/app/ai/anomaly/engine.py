"""Isolation Forest anomaly detection for movement and behavior patterns."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

try:
    from sklearn.ensemble import IsolationForest

    SKLEARN_AVAILABLE = True
except ImportError:  # pragma: no cover
    SKLEARN_AVAILABLE = False
    IsolationForest = None  # type: ignore

FEATURE_NAMES = [
    "speed_mps",
    "acceleration",
    "heading_change_deg",
    "loiter_flag",
    "zone_proximity",
    "rf_anomaly",
    "missing_adsb",
    "sensor_agreement_count",
    "persistence_ticks",
]

# Baseline "routine traffic" samples for offline fitting
_BASELINE_SAMPLES = np.array(
    [
        [45, 0.5, 5, 0, 0.05, 0, 0, 4, 2],
        [52, 1.0, 8, 0, 0.04, 0, 0, 5, 3],
        [38, 0.3, 4, 0, 0.06, 0, 0, 3, 2],
        [48, 0.8, 6, 0, 0.05, 0, 0, 4, 4],
        [30, 0.2, 3, 0, 0.08, 0, 0, 3, 1],
    ],
    dtype=float,
)

_model: Optional[Any] = None


def _get_model() -> Any:
    global _model
    if _model is not None:
        return _model
    if not SKLEARN_AVAILABLE:
        return None
    clf = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
    clf.fit(_BASELINE_SAMPLES)
    _model = clf
    return _model


def extract_feature_vector(
    track: Dict[str, Any],
    history: Dict[str, List[Dict[str, Any]]],
) -> np.ndarray:
    position = track.get("position", {})
    evidence = track.get("evidence", {})
    target_id = track.get("target_id", "")
    hist = history.get(target_id, [])
    tick = int(track.get("tick", 0))

    speed = float(position.get("speed_mps", 0.0))
    acceleration = 0.0
    if len(hist) >= 2:
        prev = hist[-2]
        prev_tick = int(prev.get("tick", tick - 1))
        dt = max(1, tick - prev_tick)
        acceleration = abs(speed - float(prev.get("speed_mps", speed))) / dt

    heading_change = float(evidence.get("heading_delta_deg", 0.0))
    loiter_flag = 1.0 if evidence.get("hovering") else 0.0
    distance_km = float(evidence.get("distance_to_zone_km", 50.0))
    zone_proximity = min(1.0, 3.0 / max(distance_km, 0.15))
    rf_anomaly = 1.0 if evidence.get("rf_signature") == "unknown" else 0.0
    missing_adsb = 0.0 if evidence.get("transponder_present") else 1.0
    sensor_count = float(len(track.get("source_sensors", [])))
    persistence = float(len(hist))

    return np.array(
        [
            speed,
            acceleration,
            heading_change,
            loiter_flag,
            zone_proximity,
            rf_anomaly,
            missing_adsb,
            sensor_count,
            persistence,
        ],
        dtype=float,
    )


def _heuristic_anomaly(features: np.ndarray) -> Dict[str, Any]:
    """Fallback when sklearn is unavailable."""
    score = 0.0
    score += min(features[4] * 0.25, 0.35)
    score += features[5] * 0.2
    score += features[6] * 0.15
    score += min(features[1] / 20.0, 0.15)
    score += min(features[2] / 90.0, 0.15)
    score = min(1.0, score)
    label = "normal" if score < 0.35 else ("suspicious" if score < 0.65 else "high-risk")
    return {
        "anomaly_score": round(score, 3),
        "anomaly_label": label,
        "confidence": round(0.55 + score * 0.35, 3),
    }


def detect_anomaly(
    track: Dict[str, Any],
    history: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Any]:
    features = extract_feature_vector(track, history)
    model = _get_model()
    if model is None:
        return _heuristic_anomaly(features)

    raw = float(model.decision_function([features])[0])
    normalized = float(np.clip((-raw + 0.15) / 0.45, 0.0, 1.0))
    if normalized < 0.35:
        label = "normal"
    elif normalized < 0.65:
        label = "suspicious"
    else:
        label = "high-risk"

    return {
        "anomaly_score": round(normalized, 3),
        "anomaly_label": label,
        "confidence": round(0.6 + normalized * 0.35, 3),
        "feature_vector": {name: round(float(features[i]), 3) for i, name in enumerate(FEATURE_NAMES)},
    }
