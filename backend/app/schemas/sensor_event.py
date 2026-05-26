"""Unified sensor event schema for all SkyShield AI sensor inputs."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

SensorType = Literal["radar", "rf", "camera", "thermal", "acoustic", "adsb"]

SENSOR_TYPES: tuple[str, ...] = ("radar", "rf", "camera", "thermal", "acoustic", "adsb")


class SensorEvent(BaseModel):
    event_id: str
    tick: int
    timestamp: Optional[float] = None
    sensor_type: SensorType
    target_id: str
    confidence: float = Field(ge=0.0, le=1.0)
    payload: Dict[str, Any] = Field(default_factory=dict)
    valid: bool = True
    noise_filtered: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


def event_from_dict(data: Dict[str, Any]) -> SensorEvent:
    return SensorEvent.model_validate(data)


def events_to_dicts(events: List[SensorEvent]) -> List[Dict[str, Any]]:
    return [e.to_dict() for e in events]
