"""Backward-compatible re-export of the threat engine."""

from backend.app.threat.engine import build_alert, classify_track, score_track

__all__ = ["build_alert", "classify_track", "score_track"]
