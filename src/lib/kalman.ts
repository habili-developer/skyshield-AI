// Simple 2D constant-velocity Kalman filter for lat/lng tracking.
// State: [lng, lat, vLng, vLat]
export class Kalman2D {
  x: number[]; // 4x1
  P: number[][]; // 4x4
  Q: number; // process noise scale
  R: number; // measurement noise scale

  constructor(lng: number, lat: number, q = 1e-6, r = 1e-5) {
    this.x = [lng, lat, 0, 0];
    this.P = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    this.Q = q;
    this.R = r;
  }

  predict(dt: number) {
    const [lng, lat, vL, vA] = this.x;
    this.x = [lng + vL * dt, lat + vA * dt, vL, vA];
    // Inflate covariance (simplified diagonal)
    for (let i = 0; i < 4; i++) this.P[i][i] += this.Q * dt;
    return [this.x[0], this.x[1]];
  }

  update(lng: number, lat: number) {
    // Innovation
    const yLng = lng - this.x[0];
    const yLat = lat - this.x[1];
    // Kalman gain (simplified scalar per axis)
    const sLng = this.P[0][0] + this.R;
    const sLat = this.P[1][1] + this.R;
    const kLng = this.P[0][0] / sLng;
    const kLat = this.P[1][1] / sLat;
    // Update position
    this.x[0] += kLng * yLng;
    this.x[1] += kLat * yLat;
    // Update velocity (cross-correlated lightly)
    this.x[2] = 0.85 * this.x[2] + 0.15 * yLng;
    this.x[3] = 0.85 * this.x[3] + 0.15 * yLat;
    // Reduce covariance
    this.P[0][0] *= 1 - kLng;
    this.P[1][1] *= 1 - kLat;
  }

  /** Predict future track without mutating state */
  forecast(steps: number, dt: number): [number, number][] {
    const pts: [number, number][] = [];
    let [lng, lat, vL, vA] = this.x;
    for (let i = 1; i <= steps; i++) {
      lng += vL * dt;
      lat += vA * dt;
      pts.push([lng, lat]);
    }
    return pts;
  }
}
