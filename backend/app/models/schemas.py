
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OperatorQuestion(BaseModel):
    question: str = Field(..., min_length=3, description="Operator question for the LLM copilot")


class SummaryRequest(BaseModel):
    focus: Optional[str] = Field(default=None, description="Optional summary focus such as latest alert or full incident")


class LLMResponse(BaseModel):
    provider: str
    model: str
    answer: str
    grounded_sections: List[Dict[str, str]] = Field(default_factory=list)
    warning: Optional[str] = None


class StepResponse(BaseModel):
    tick: int
    scenario: str
    ended: bool
    sensor_events: List[Dict[str, Any]]
    fused_tracks: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]


class ResetResponse(BaseModel):
    message: str
    scenario: str
    available_scenarios: List[str]


class RunResponse(BaseModel):
    tick: int
    scenario: str
    ended: bool
    steps_executed: int
    latest_alerts: List[Dict[str, Any]]
    latest_tracks: List[Dict[str, Any]]


class StateResponse(BaseModel):
    scenario: str
    tick: int
    ended: bool
    restricted_zone: Dict[str, Any]
    latest_tracks: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    recent_sensor_events: List[Dict[str, Any]]
    history: Dict[str, List[Dict[str, Any]]]
    event_timeline: List[Dict[str, Any]] = Field(default_factory=list)
    operator_logs: List[Dict[str, Any]] = Field(default_factory=list)
    sensor_feed: List[Dict[str, Any]] = Field(default_factory=list)
    temporal_state: Dict[str, Any] = Field(default_factory=dict)
    system_health: Dict[str, Any] = Field(default_factory=dict)
