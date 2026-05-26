import math
import random
from datetime import datetime, timezone
from typing import List, Dict, Literal
from app.kalman import Kalman2D

DODOMA = (35.7384, -6.1748)
PROTECTED_RADIUS_KM = 8.0

ThreatLevel = Literal["GREEN", "YELLOW", "RED"]
TrackType = Literal["UAV", "ROTOR", "FIXED-WING", "UNKNOWN"]


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371
    to_rad = lambda d: d * math.pi / 180
    d_lat = to_rad(b[1] - a[1])
    d_lng = to_rad(b[0] - a[0])
    s = (math.sin(d_lat / 2) ** 2
         + math.cos(to_rad(a[1])) * math.cos(to_rad(b[1])) * math.sin(d_lng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(s))


def classify_level(true_lng: float, true_lat: float) -> ThreatLevel:
    d = haversine_km((true_lng, true_lat), DODOMA)
    if d < PROTECTED_RADIUS_KM * 0.5:
        return "RED"
    if d < PROTECTED_RADIUS_KM:
        return "YELLOW"
    return "GREEN"


class Track:
    _id_counter = 0

    def __init__(self):
        Track._id_counter += 1
        self.id = f"T-{Track._id_counter:04d}"
        self.callsign = f"TRK-{random.randint(1000, 9999)}"
        self.type = random.choice(["UAV", "ROTOR", "FIXED-WING", "UNKNOWN"])

        bearing = random.uniform(0, 2 * math.pi)
        dist_deg = 0.12 + random.uniform(0, 0.05)
        self.true_lng = DODOMA[0] + math.cos(bearing) * dist_deg
        self.true_lat = DODOMA[1] + math.sin(bearing) * dist_deg

        speed = random.uniform(0.0006, 0.0014)
        self.v_lng = -math.cos(bearing) * speed
        self.v_lat = -math.sin(bearing) * speed

        self.kf = Kalman2D(self.true_lng, self.true_lat)
        self.history: List[List[float]] = [[self.kf.x[0], self.kf.x[1]]]
        self.level = "GREEN"
        self.speed_kts = round(random.uniform(45, 180))
        self.altitude_m = round(random.uniform(120, 1800))
        self.bearing = (math.degrees(bearing) + 180) % 360
        self.rcs = round(random.uniform(0.05, 1.4), 2)


class Alert:
    _id_counter = 0

    def __init__(self, track_id: str, level: ThreatLevel):
        Alert._id_counter += 1
        self.id = f"A-{Alert._id_counter:04d}"
        self.ts = datetime.now(timezone.utc).isoformat()
        self.level = level
        self.track_id = track_id
        self.acknowledged = False
        if level == "YELLOW":
            self.title = "Unidentified object approaching"
            self.body = "Monitor object closely"
        elif level == "RED":
            self.title = "Immediate threat detected"
            self.body = "Intercept authorization required"
        else:
            self.title = "Object status updated"
            self.body = "Object now in safe zone"


class SimulationEngine:
    def __init__(self):
        self.tracks: Dict[str, Track] = {}
        self.alerts: Dict[str, Alert] = {}
        self.tick = 0

    def reset(self):
        self.tracks = {}
        self.alerts = {}
        self.tick = 0

    def step(self, dt_ms: float = 250.0):
        self.tick += 1
        dt = dt_ms / 1000.0

        if len(self.tracks) < 3 or random.random() < 0.05:
            track = Track()
            self.tracks[track.id] = track

        to_remove = []
        for track in self.tracks.values():
            track.true_lng += track.v_lng * dt + (random.random() - 0.5) * 0.0001
            track.true_lat += track.v_lat * dt + (random.random() - 0.5) * 0.0001

            meas_lng = track.true_lng + (random.random() - 0.5) * 0.0008
            meas_lat = track.true_lat + (random.random() - 0.5) * 0.0008
            track.kf.predict(dt)
            track.kf.update(meas_lng, meas_lat)

            track.history.append([track.kf.x[0], track.kf.x[1]])
            if len(track.history) > 80:
                track.history = track.history[-80:]

            new_level = classify_level(track.true_lng, track.true_lat)
            if new_level != track.level:
                alert = Alert(track.id, new_level)
                self.alerts[alert.id] = alert
            track.level = new_level

            d = haversine_km((track.true_lng, track.true_lat), DODOMA)
            if d > 20:
                to_remove.append(track.id)

        for track_id in to_remove:
            del self.tracks[track_id]
