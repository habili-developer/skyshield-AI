"""Operational hooks for external GPS, SDR, and aviation telemetry sources."""

from __future__ import annotations

from backend.app.ingestion.adapters import GPSStreamAdapter, RFIngestionAdapter, TelemetryStreamAdapter


class SDRCompatibleHook(RFIngestionAdapter):
    """Placeholder for SDR receiver integrations that emit passive RF observations."""


class PublicAviationTelemetryHook(TelemetryStreamAdapter):
    """Generic WebSocket telemetry hook for public aviation data providers."""


class GPSTelemetryHook(GPSStreamAdapter):
    """Generic GPS stream hook for cooperative operational assets."""
