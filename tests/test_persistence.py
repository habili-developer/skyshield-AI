import os
from pathlib import Path

from backend.app.services.persistent_store import SqliteStore


def test_sqlite_store_persists_state(tmp_path: Path):
    db_path = tmp_path / "skyshield.db"
    store = SqliteStore(db_path)

    store.reset("normal", {"center": {"lat": 10.0, "lon": 20.0}, "radius_km": 2.0})
    store.apply_step(
        tick=1,
        sensor_events=[{"event_id": "radar-1-TGT", "tick": 1, "sensor_type": "radar", "target_id": "TGT", "confidence": 0.9, "payload": {"lat": 10.0, "lon": 20.0, "altitude_m": 100}}],
        fused_tracks=[{"target_id": "TGT", "position": {"lat": 10.0, "lon": 20.0, "altitude_m": 100, "heading_deg": 0, "speed_mps": 10}, "threat_score": 50, "threat_level": "yellow"}],
        alerts=[{"target_id": "TGT", "message": "Test alert"}],
        ended=False,
    )
    snapshot = store.snapshot()
    assert snapshot["tick"] == 1
    assert snapshot["alerts"][0]["target_id"] == "TGT"

    store.close()

    reopened = SqliteStore(db_path)
    snapshot2 = reopened.snapshot()
    assert snapshot2["tick"] == 1
    assert snapshot2["alerts"][0]["message"] == "Test alert"
    reopened.close()
