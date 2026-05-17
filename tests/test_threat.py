
from backend.app.services.threat import score_track


def test_red_alert_for_intrusion_track():
    track = {
        "target_id": "INTR-RED",
        "tick": 4,
        "position": {"lat": -6.1748, "lon": 35.7384, "altitude_m": 72, "heading_deg": 160, "speed_mps": 4},
        "source_sensors": ["radar", "rf", "camera", "thermal", "acoustic"],
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
        },
    }
    result = score_track(track)
    assert result["threat_level"] == "red"
    assert result["threat_score"] >= 60
