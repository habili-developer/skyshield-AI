import numpy as np
from typing import Dict, Any, Tuple

class AirspaceKalmanFilter:
    """
    A 3D Kalman Filter for tracking aircraft position and velocity.
    State vector (x): [lat, lon, alt, v_lat, v_lon, v_alt]
    """
    def __init__(self, initial_state: np.ndarray, dt: float = 1.0):
        self.dt = dt
        # State transition matrix (F)
        self.F = np.eye(6)
        self.F[0, 3] = dt
        self.F[1, 4] = dt
        self.F[2, 5] = dt

        # Measurement matrix (H) - we only measure position [lat, lon, alt]
        self.H = np.zeros((3, 6))
        self.H[0, 0] = 1
        self.H[1, 1] = 1
        self.H[2, 2] = 1

        # Process noise covariance (Q)
        self.Q = np.eye(6) * 0.01
        
        # Measurement noise covariance (R) - will be updated per sensor
        self.R = np.eye(3) * 0.1

        # Initial state covariance (P)
        self.P = np.eye(6) * 500.0

        # State vector
        self.x = initial_state

    def predict(self):
        """Predict the next state."""
        self.x = self.F @ self.x
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self.x

    def update(self, measurement: np.ndarray, sensor_weight: float = 1.0):
        """
        Update the state with a new measurement.
        sensor_weight: 1.0 is normal, higher means more trust (smaller R), lower means less trust.
        """
        # Adjust measurement noise based on sensor confidence/weight
        # A higher weight reduces the measurement noise covariance R
        R_adjusted = self.R / max(sensor_weight, 0.01)
        
        # Innovation (y)
        y = measurement - (self.H @ self.x)
        
        # Innovation covariance (S)
        S = self.H @ self.P @ self.H.T + R_adjusted
        
        # Kalman Gain (K)
        K = self.P @ self.H.T @ np.linalg.inv(S)
        
        # Updated state (x)
        self.x = self.x + (K @ y)
        
        # Updated covariance (P)
        I = np.eye(6)
        self.P = (I - K @ self.H) @ self.P
        
        return self.x

    def get_state_dict(self) -> Dict[str, float]:
        return {
            "lat": float(self.x[0]),
            "lon": float(self.x[1]),
            "altitude_m": float(self.x[2]),
            "v_lat": float(self.x[3]),
            "v_lon": float(self.x[4]),
            "v_alt": float(self.x[5]),
        }
