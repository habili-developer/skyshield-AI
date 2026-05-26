import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/skyshield/Header";
import { AlertFeed } from "@/components/skyshield/AlertFeed";
import { MapView } from "@/components/skyshield/MapView";
import { StatsPanel } from "@/components/skyshield/StatsPanel";
import { CopilotPanel } from "@/components/skyshield/CopilotPanel";
import { RadarFeed } from "@/components/skyshield/RadarFeed";
import { Footer } from "@/components/skyshield/Footer";
import {
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
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(true);
  const [stats, setStats] = useState({ cpu: 14.2, mem: 2.4, latency: 12 });
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const stepOnce = () => {
    setTick((t) => t + 1);
    setTracks((prev) => {
      let next = [...prev];
      // Spawn
      if (next.length < 6 && Math.random() < 0.35) next.push(spawnTrack());
      // Step each
      next.forEach((t) => stepTrack(t, 1000));
      // Remove if too close (intercepted) or drifted out
      next = next.filter((t) => {
        const out = Math.hypot(t.trueLng - 35.7384, t.trueLat + 6.1748) > 0.25;
        return !out;
      });
      // Build alerts from level transitions
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
                    : "Monitor object closely",
                body:
                  t.level === "RED"
                    ? `${t.callsign} (${t.type}) breached inner perimeter. Speed ${t.speedKts}kts, alt ${t.altitudeM}m. Kalman forecast shows continued inbound vector. Recommend RF disrupt + intercept readiness.`
                    : `${t.callsign} approaching the restricted zone. No cooperative identity signal observed. RF signature inconsistent with civilian profile. Recommend continued tracking.`,
                acknowledged: false,
              });
            }
          }
        });
        return [...additions, ...al].slice(0, 40);
      });
      return next;
    });
    setStats({
      cpu: 12 + Math.random() * 8,
      mem: 2.2 + Math.random() * 0.8,
      latency: 8 + Math.floor(Math.random() * 12),
    });
  };

  useEffect(() => {
    if (!auto) return;
    const i = setInterval(stepOnce, 1000);
    return () => clearInterval(i);
  }, [auto]);

  const recentLevel: ThreatLevel =
    tracks.find((t) => t.level === "RED")?.level ??
    tracks.find((t) => t.level === "YELLOW")?.level ??
    "GREEN";

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header
        tick={tick}
        auto={auto}
        onToggleAuto={() => setAuto((a) => !a)}
        onStep={stepOnce}
        onReset={() => {
          setTracks([]); setAlerts([]); setTick(0);
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <AlertFeed
          alerts={alerts}
          onAck={(id) =>
            setAlerts((al) => al.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)))
          }
        />
        <main className="flex flex-1 flex-col">
          <MapView tracks={tracks} />
          <RadarFeed tracks={tracks} />
        </main>
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-panel-border bg-panel">
          <StatsPanel
            cpu={stats.cpu}
            mem={stats.mem}
            latency={stats.latency}
            sensors="6/6 ONLINE"
            tracks={tracks.length}
          />
          <CopilotPanel recentLevel={recentLevel} />
        </aside>
      </div>
      <Footer />
    </div>
  );
}
