from pydantic import BaseModel
from typing import List, Literal, Optional

ThreatLevel = Literal["GREEN", "YELLOW", "RED"]
TrackType = Literal["UAV", "ROTOR", "FIXED-WING", "UNKNOWN"]


class TrackOut(BaseModel):
    id: str
    callsign: str
    type: TrackType
    lng: float
    lat: float
    vLng: float
    vLat: float
    speed_kts: int
    altitude_m: int
    bearing: float
    rcs: float
    level: ThreatLevel
    history: List[List[float]]
    forecast: List[List[float]]


class AlertOut(BaseModel):
    id: str
    ts: str
    level: ThreatLevel
    title: str
    body: str
    track_id: str
    acknowledged: bool


class StatsOut(BaseModel):
    cpu: float
    mem_gb: float
    latency_ms: float
    sensors: str


class WsFrameOut(BaseModel):
    tick: int
    ts: str
    tracks: List[TrackOut]
    alerts: List[AlertOut]
    stats: StatsOut


class CopilotRequest(BaseModel):
    query: str
    context: dict


class HealthzOut(BaseModel):
    status: Literal["ok"]
