"""Persistence repository for operational event history."""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List

from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError

from backend.app.database.models import AlertRecord, AnomalyRecord, OperationalBase, OperationalLogRecord, SensorEventRecord, TrackRecord
from backend.app.database.session import get_engine, get_session_factory


logger = logging.getLogger("skyshield.database")


class OperationalRepository:
    def __init__(self) -> None:
        OperationalBase.metadata.create_all(bind=get_engine())
        self.session_factory = get_session_factory()

    def persist_step(
        self,
        *,
        tick: int,
        sensor_events: Iterable[Dict[str, Any]],
        tracks: Iterable[Dict[str, Any]],
        alerts: Iterable[Dict[str, Any]],
    ) -> None:
        try:
            with self.session_factory() as session:
                for event in sensor_events:
                    session.add(
                        SensorEventRecord(
                            event_id=str(event.get("event_id", f"evt-{tick}")),
                            target_id=str(event.get("target_id", "unknown")),
                            sensor_type=str(event.get("sensor_type", "unknown")),
                            tick=tick,
                            confidence=float(event.get("confidence", 0)),
                            payload=event,
                        )
                    )
                for track in tracks:
                    position = track.get("position", {})
                    session.add(
                        TrackRecord(
                            target_id=str(track.get("target_id", "unknown")),
                            tick=tick,
                            threat_level=str(track.get("threat_level", "green")),
                            threat_score=int(track.get("threat_score", 0)),
                            lat=float(position.get("lat", 0)),
                            lon=float(position.get("lon", 0)),
                            altitude_m=float(position.get("altitude_m", 0)),
                            speed_mps=float(position.get("speed_mps", 0)),
                            payload=track,
                        )
                    )
                    anomaly = track.get("anomaly") or {}
                    if anomaly:
                        session.add(
                            AnomalyRecord(
                                target_id=str(track.get("target_id", "unknown")),
                                tick=tick,
                                anomaly_score=float(anomaly.get("anomaly_score", 0)),
                                anomaly_label=str(anomaly.get("anomaly_label", "normal")),
                                confidence=float(anomaly.get("confidence", 0)),
                                payload=anomaly,
                            )
                        )
                for alert in alerts:
                    session.add(
                        AlertRecord(
                            alert_id=str(alert.get("alert_id", f"alert-{tick}")),
                            target_id=str(alert.get("target_id", "unknown")),
                            tick=tick,
                            level=str(alert.get("level", "yellow")),
                            title=str(alert.get("title", "Alert")),
                            explanation=str(alert.get("explanation", "")),
                            payload=alert,
                        )
                    )
                session.commit()
        except SQLAlchemyError:
            logger.exception("failed to persist operational step")

    def log(self, event_type: str, message: str, tick: int = 0, payload: Dict[str, Any] | None = None) -> None:
        try:
            with self.session_factory() as session:
                session.add(OperationalLogRecord(tick=tick, event_type=event_type, message=message, payload=payload or {}))
                session.commit()
        except SQLAlchemyError:
            logger.exception("failed to persist operational log")

    def metrics(self) -> Dict[str, Any]:
        with self.session_factory() as session:
            return {
                "sensor_events": session.query(SensorEventRecord).count(),
                "tracks": session.query(TrackRecord).count(),
                "alerts": session.query(AlertRecord).count(),
                "anomalies": session.query(AnomalyRecord).count(),
                "operational_logs": session.query(OperationalLogRecord).count(),
            }

    def recent_tracks(self, target_id: str | None = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            query = session.query(TrackRecord)
            if target_id:
                query = query.filter(TrackRecord.target_id == target_id)
            rows = query.order_by(desc(TrackRecord.created_at)).limit(limit).all()
            return [
                {
                    "target_id": row.target_id,
                    "tick": row.tick,
                    "threat_level": row.threat_level,
                    "threat_score": row.threat_score,
                    "position": {
                        "lat": row.lat,
                        "lon": row.lon,
                        "altitude_m": row.altitude_m,
                        "speed_mps": row.speed_mps,
                    },
                    "created_at": row.created_at.isoformat(),
                    "payload": row.payload,
                }
                for row in rows
            ]

    def recent_alerts(self, level: str | None = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            query = session.query(AlertRecord)
            if level:
                query = query.filter(AlertRecord.level == level)
            rows = query.order_by(desc(AlertRecord.created_at)).limit(limit).all()
            return [
                {
                    "alert_id": row.alert_id,
                    "target_id": row.target_id,
                    "tick": row.tick,
                    "level": row.level,
                    "title": row.title,
                    "explanation": row.explanation,
                    "created_at": row.created_at.isoformat(),
                    "payload": row.payload,
                }
                for row in rows
            ]

    def recent_anomalies(self, target_id: str | None = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            query = session.query(AnomalyRecord)
            if target_id:
                query = query.filter(AnomalyRecord.target_id == target_id)
            rows = query.order_by(desc(AnomalyRecord.created_at)).limit(limit).all()
            return [
                {
                    "target_id": row.target_id,
                    "tick": row.tick,
                    "anomaly_score": row.anomaly_score,
                    "anomaly_label": row.anomaly_label,
                    "confidence": row.confidence,
                    "created_at": row.created_at.isoformat(),
                    "payload": row.payload,
                }
                for row in rows
            ]

    def replay_session(self, target_id: str | None = None, limit: int = 250) -> Dict[str, Any]:
        tracks = list(reversed(self.recent_tracks(target_id=target_id, limit=limit)))
        alerts = list(reversed(self.recent_alerts(limit=limit)))
        anomalies = list(reversed(self.recent_anomalies(target_id=target_id, limit=limit)))
        return {
            "target_id": target_id,
            "tracks": tracks,
            "alerts": alerts,
            "anomalies": anomalies,
            "samples": len(tracks),
        }
