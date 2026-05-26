from backend.app.ai.anomaly.engine import detect_anomaly, extract_feature_vector
from backend.app.threat.engine import score_track


def test_anomaly_output_shape():
    track = {
        "target_id": "T-1",
        "tick": 3,
        "position": {"lat": -6.17, "lon": 35.73, "altitude_m": 80, "heading_deg": 90, "speed_mps": 6},
        "source_sensors": ["radar", "rf"],
        "fusion_confidence": 0.7,
        "evidence": {
            "transponder_present": False,
            "rf_signature": "unknown",
            "camera_label": "unknown_object",
            "hovering": True,
            "maneuvering": True,
            "heading_delta_deg": 50,
            "distance_to_zone_km": 0.4,
            "in_restricted_zone": False,
            "sensor_weight": 2.5,
            "sensor_conflicts": [],
        },
    }
    result = detect_anomaly(track, {})
    assert 0 <= result["anomaly_score"] <= 1
    assert result["anomaly_label"] in {"normal", "suspicious", "high-risk"}
    assert 0 <= result["confidence"] <= 1


def test_score_track_includes_trace_and_anomaly():
    track = {
        "target_id": "INTR-RED",
        "tick": 4,
        "position": {"lat": -6.1748, "lon": 35.7384, "altitude_m": 72, "heading_deg": 160, "speed_mps": 4},
        "source_sensors": ["radar", "rf", "camera", "thermal", "acoustic"],
        "fusion_confidence": 0.82,
        "evidence": {
            "transponder_present": False,
            "rf_signature": "unknown",
            "camera_label": "unidentified_airframe",
            "thermal_score": 0.63,
            "hovering": True,
            "maneuvering": True,
            "heading_delta_deg": 90,
            "distance_to_zone_km": 0.05,
            "in_restricted_zone": True,
            "sensor_weight": 3.5,
            "sensor_conflicts": [],
        },
    }
    temporal = {"targets": {}}
    result = score_track(track, history={}, temporal_state=temporal)
    assert "explanation_trace" in result
    assert len(result["explanation_trace"]) > 0
    assert "anomaly" in result
    assert result["threat_level"] == "red"
