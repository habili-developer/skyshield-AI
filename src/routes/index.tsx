import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/skyshield/Header";
import { MapView } from "@/components/skyshield/MapView";
import { CopilotPanel } from "@/components/skyshield/CopilotPanel";
import { ActiveTracksPanel } from "@/components/skyshield/ActiveTracksPanel";
import { TacticalEventFeed } from "@/components/skyshield/TacticalEventFeed";
import { SystemTelemetryPanel } from "@/components/skyshield/SystemTelemetryPanel";
import { RadarStatusPanel } from "@/components/skyshield/RadarStatusPanel";
import { Footer } from "@/components/skyshield/Footer";
import {
  formatEta,
  getTrackEtaSeconds,
  spawnTrack,
  stepTrack,
  type Track,
  type AlertItem,
  type ThreatLevel,
} from "@/lib/simulation";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [events, setEvents] = useState<Array<{
    id: string;
    ts: number;
    code: "INFO" | "WARNING" | "ALERT";
    body: string;
  }>>([]);
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(true);
  const [stats, setStats] = useState({ cpu: 14.2, mem: 2.4, latency: 12 });
  const tickRef = useRef(0);

  const initializeScene = () => {
    const seededTracks = Array.from({ length: 7 }, () => spawnTrack());
    tickRef.current = 0;
    setTick(0);
    setTracks(seededTracks);
    setAlerts([]);
    setEvents([
      {
        id: "bootstrap-1",
        ts: Date.now(),
        code: "INFO",
        body: "Authorized traffic sweep initialized across Dodoma sector.",
      },
      {
        id: "bootstrap-2",
        ts: Date.now() - 1500,
        code: "INFO",
        body: "Radar mesh synchronized. Predictive Kalman tracks available.",
      },
    ]);
  };

  const stepOnce = () => {
    const nextTick = tickRef.current + 1;
    tickRef.current = nextTick;
    setTick(nextTick);
    setTracks((prev) => {
      let next = [...prev];
      if (next.length < 12 && Math.random() < 0.42) next.push(spawnTrack());
      next.forEach((t) => stepTrack(t, 1000));
      next = next.filter((t) => {
        const out = Math.hypot(t.trueLng - 35.7384, t.trueLat + 6.1748) > 0.28;
        return !out;
      });

      setAlerts((al) => {
        const now = Date.now();
        const additions: AlertItem[] = [];
        next.forEach((t) => {
          const last = al.find((a) => a.trackId === t.id);
          if (!last || last.level !== t.level) {
            if (t.level !== "GREEN") {
              additions.push({
                id: `${t.id}-${now}-${t.level}`,
                ts: now,
                level: t.level,
                trackId: t.id,
                title:
                  t.level === "RED"
                    ? "Intercept authorization required"
                    : t.level === "ORANGE"
                      ? "Predicted breach developing"
                      : "Monitor object closely",
                body:
                  t.level === "RED"
                    ? `${t.callsign} (${t.type}) breached inner perimeter. Speed ${t.speedKts}kts, alt ${t.altitudeM}m. Kalman forecast shows continued inbound vector. Recommend RF disrupt + intercept readiness.`
                    : t.level === "ORANGE"
                      ? `${t.callsign} is on a converging approach to the restricted core. ETA ${formatEta(getTrackEtaSeconds(t))}. Escalate monitoring and prepare non-kinetic response.`
                      : `${t.callsign} approaching the restricted zone. No cooperative identity signal observed. RF signature inconsistent with civilian profile. Recommend continued tracking.`,
                acknowledged: false,
              });
            }
          }
        });
        return [...additions, ...al].slice(0, 40);
      });

      setEvents((prevEvents) => {
        const now = Date.now();
        const criticalTrack =
          next.find((track) => track.level === "RED") ??
          next.find((track) => track.level === "ORANGE") ??
          next.find((track) => track.level === "YELLOW") ??
          next[0];

        const event =
          !criticalTrack ? {
            id: `${now}-scan-clear`,
            ts: now,
            code: "INFO" as const,
            body: "Sector sweep complete. No active threat vectors approaching the core.",
          } :
          criticalTrack.level === "RED" ? {
            id: `${now}-${criticalTrack.id}-breach`,
            ts: now,
            code: "ALERT" as const,
            body: `${criticalTrack.callsign} predicted breach in ${formatEta(getTrackEtaSeconds(criticalTrack))}. Immediate intercept coordination required.`,
          } :
          criticalTrack.level === "ORANGE" ? {
            id: `${now}-${criticalTrack.id}-rf`,
            ts: now,
            code: "WARNING" as const,
            body: `RF anomaly detected on ${criticalTrack.callsign}. Heading changed toward restricted core.`,
          } :
          {
            id: `${now}-${criticalTrack.id}-track`,
            ts: now,
            code: "INFO" as const,
            body: `Outbound traffic ${criticalTrack.callsign} updated. Kalman path refreshed for sector monitoring.`,
          };

        return [event, ...prevEvents].slice(0, 10);
      });

      return next;
    });
    setStats({
      cpu: 26 + Math.random() * 12,
      mem: 2.1 + Math.random() * 0.4,
      latency: 9 + Math.floor(Math.random() * 6),
    });
  };

  useEffect(() => {
    initializeScene();
  }, []);

  useEffect(() => {
    if (!auto) return;
    if (tracks.length === 0) return;
    const i = setInterval(stepOnce, 850);
    return () => clearInterval(i);
  }, [auto, tracks.length]);

  const recentLevel: ThreatLevel = useMemo(() =>
    tracks.find((t) => t.level === "RED")?.level ??
    tracks.find((t) => t.level === "ORANGE")?.level ??
    tracks.find((t) => t.level === "YELLOW")?.level ??
    "GREEN",
  [tracks]);

  return (
    <div className="flex h-screen min-h-screen flex-col bg-background text-foreground">
      <Header
        tick={tick}
        auto={auto}
        onToggleAuto={() => setAuto((a) => !a)}
        onStep={stepOnce}
        onReset={initializeScene}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-panel-border bg-panel">
          <ActiveTracksPanel tracks={tracks} />
        </aside>
        <main className="min-w-0 border-r border-panel-border bg-panel">
          <MapView tracks={tracks} tick={tick} />
        </main>
        <aside className="flex min-h-0 flex-col bg-panel">
          <CopilotPanel recentLevel={recentLevel} tracks={tracks} />
        </aside>
      </div>
      <div className="grid h-[132px] grid-cols-[320px_minmax(0,1fr)_360px] border-t border-panel-border bg-panel">
        <TacticalEventFeed events={events} />
        <SystemTelemetryPanel
          cpu={stats.cpu}
          mem={stats.mem}
          latency={stats.latency}
          sensors="6/6 ONLINE"
        />
        <RadarStatusPanel />
      </div>
      <Footer />
    </div>
  );
}
