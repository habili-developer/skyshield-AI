import numpy as np
from typing import List, Tuple


class Kalman2D:
    def __init__(self, lng: float, lat: float, q: float = 1e-6, r: float = 1e-5):
        self.x = np.array([lng, lat, 0.0, 0.0], dtype=np.float64)
        self.P = np.eye(4, dtype=np.float64)
        self.Q = q
        self.R = r

    def predict(self, dt: float) -> Tuple[float, float]:
        lng, lat, vL, vA = self.x
        self.x = np.array([lng + vL * dt, lat + vA * dt, vL, vA], dtype=np.float64)
        for i in range(4):
            self.P[i][i] += self.Q * dt
        return (self.x[0], self.x[1])

    def update(self, lng: float, lat: float):
        yLng = lng - self.x[0]
        yLat = lat - self.x[1]
        sLng = self.P[0][0] + self.R
        sLat = self.P[1][1] + self.R
        kLng = self.P[0][0] / sLng
        kLat = self.P[1][1] / sLat
        self.x[0] += kLng * yLng
        self.x[1] += kLat * yLat
        self.x[2] = 0.85 * self.x[2] + 0.15 * yLng
        self.x[3] = 0.85 * self.x[3] + 0.15 * yLat
        self.P[0][0] *= 1 - kLng
        self.P[1][1] *= 1 - kLat

    def forecast(self, steps: int, dt: float) -> List[Tuple[float, float]]:
        pts = []
        lng, lat, vL, vA = self.x
        for i in range(1, steps + 1):
            lng += vL * dt
            lat += vA * dt
            pts.append((lng, lat))
        return pts
