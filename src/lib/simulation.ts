import { Kalman2D } from "./kalman";

export const DODOMA: [number, number] = [35.7384, -6.1748];
export const PROTECTED_RADIUS_KM = 8;

export type ThreatLevel = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface Track {
  id: string;
  callsign: string;
  type: "UAV" | "ROTOR" | "FIXED-WING" | "UNKNOWN";
  trueLng: number;
  trueLat: number;
  vLng: number;
  vLat: number;
  kf: Kalman2D;
  history: [number, number][];
  level: ThreatLevel;
  speedKts: number;
  altitudeM: number;
  bearing: number;
  rcs: number;
  spawnedAt: number;
}

export interface AlertItem {
  id: string;
  ts: number;
  level: ThreatLevel;
  title: string;
  body: string;
  trackId: string;
  acknowledged: boolean;
}

let _id = 0;
const id = () => `T-${(++_id).toString().padStart(4, "0")}`;

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

export function spawnTrack(): Track {
  const bearing = rand(0, Math.PI * 2);
  const distDeg = 0.12 + Math.random() * 0.05; // ~13km out
  const trueLng = DODOMA[0] + Math.cos(bearing) * distDeg;
  const trueLat = DODOMA[1] + Math.sin(bearing) * distDeg;
  // velocity toward Dodoma
  const speed = rand(0.0006, 0.0014);
  const vLng = -Math.cos(bearing) * speed;
  const vLat = -Math.sin(bearing) * speed;
  const types: Track["type"][] = ["UAV", "ROTOR", "FIXED-WING", "UNKNOWN"];
  return {
    id: id(),
    callsign: `TRK-${Math.floor(Math.random() * 9000 + 1000)}`,
    type: types[Math.floor(Math.random() * types.length)],
    trueLng, trueLat, vLng, vLat,
    kf: new Kalman2D(trueLng, trueLat),
    history: [[trueLng, trueLat]],
    level: "GREEN",
    speedKts: Math.round(rand(45, 180)),
    altitudeM: Math.round(rand(120, 1800)),
    bearing: (bearing * 180 / Math.PI + 180) % 360,
    rcs: +rand(0.05, 1.4).toFixed(2),
    spawnedAt: Date.now(),
  };
}

/** Distance in km between two lat/lng */
export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function classify(track: Track): ThreatLevel {
  const d = haversineKm([track.trueLng, track.trueLat], DODOMA);
  if (d < PROTECTED_RADIUS_KM * 0.5) return "RED";
  if (d < PROTECTED_RADIUS_KM * 0.75) return "ORANGE";
  if (d < PROTECTED_RADIUS_KM) return "YELLOW";
  return "GREEN";
}

export function getTrackDistanceKm(track: Track): number {
  return haversineKm([track.kf.x[0], track.kf.x[1]], DODOMA);
}

export function getTrackEtaSeconds(track: Track): number {
  const speedKmh = Math.max(track.speedKts * 1.852, 1);
  return Math.max(5, Math.round((getTrackDistanceKm(track) / speedKmh) * 3600));
}

export function formatEta(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `00:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getTrackConfidence(track: Track): number {
  const idNum = Number.parseInt(track.id.replace(/\D/g, ""), 10) || 1;
  const typeBias =
    track.type === "UNKNOWN" ? -6 :
    track.type === "UAV" ? 4 :
    track.type === "ROTOR" ? 1 : 3;
  const rcsBias = Math.round((1.4 - Math.min(track.rcs, 1.4)) * 12);
  return Math.max(58, Math.min(99, 68 + (idNum % 17) + typeBias + rcsBias));
}

export function stepTrack(t: Track, dtMs: number) {
  const dt = dtMs / 1000;
  // True motion + small jitter
  t.trueLng += t.vLng * dt + (Math.random() - 0.5) * 0.0001;
  t.trueLat += t.vLat * dt + (Math.random() - 0.5) * 0.0001;
  // Noisy measurement
  const measLng = t.trueLng + (Math.random() - 0.5) * 0.0008;
  const measLat = t.trueLat + (Math.random() - 0.5) * 0.0008;
  t.kf.predict(dt);
  t.kf.update(measLng, measLat);
  t.history.push([t.kf.x[0], t.kf.x[1]]);
  if (t.history.length > 80) t.history.shift();
  t.level = classify(t);
}
