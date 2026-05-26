import { useState } from "react";
import { Target, Activity, Compass, Clock, Shield, Funnel } from "lucide-react";
import type { Track } from "@/lib/simulation";
import { formatEta, getTrackConfidence, getTrackDistanceKm, getTrackEtaSeconds } from "@/lib/simulation";

interface Props {
  tracks: Track[];
}

const levelStyles = {
  RED: "border-l-threat-red bg-threat-red/10 text-threat-red shadow-[inset_0_0_18px_rgba(239,68,68,0.08)]",
  ORANGE: "border-l-orange-400 bg-orange-500/10 text-orange-300 shadow-[inset_0_0_18px_rgba(251,146,60,0.08)]",
  YELLOW: "border-l-threat-yellow bg-threat-yellow/10 text-threat-yellow shadow-[inset_0_0_18px_rgba(250,204,21,0.06)]",
  GREEN: "border-l-threat-green bg-threat-green/8 text-threat-green shadow-[inset_0_0_18px_rgba(34,197,94,0.06)]",
} as const;

const statusLabels = {
  RED: "INTRUSION IMMINENT",
  ORANGE: "SUSPICIOUS APPROACH",
  YELLOW: "SUSPICIOUS",
  GREEN: "AUTHORIZED",
} as const;

export function ActiveTracksPanel({ tracks }: Props) {
  const [filter, setFilter] = useState<"ALL" | "UAV" | "AIR" | "UNK">("ALL");

  const filteredTracks = tracks.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "UAV") return t.type === "UAV";
    if (filter === "AIR") return t.type === "ROTOR" || t.type === "FIXED-WING";
    if (filter === "UNK") return t.type === "UNKNOWN";
    return true;
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-3 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-threat-red" />
          <h2 className="font-mono text-[11px] tracking-[0.16em] text-foreground">
            ACTIVE TRACKS ({tracks.length})
          </h2>
        </div>
        <button className="flex h-7 w-7 items-center justify-center border border-panel-border text-muted-foreground">
          <Funnel className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-panel-border px-2 py-2">
        {(["ALL", "UAV", "AIR", "UNK"] as const).map((f, index) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-7 flex-1 border px-2 font-mono text-[10px] tracking-[0.12em] transition-all ${
              filter === f
                ? "border-threat-red/60 bg-threat-red/10 text-threat-red"
                : "border-panel-border text-muted-foreground hover:border-threat-yellow/60 hover:text-threat-yellow"
            }`}
          >
            {index === 0 ? "ALL" : `${f} (${tracks.filter((t) => (
              f === "UAV" ? t.type === "UAV" :
              f === "AIR" ? t.type === "ROTOR" || t.type === "FIXED-WING" :
              t.type === "UNKNOWN"
            )).length})`}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredTracks.length === 0 && (
          <div className="px-4 py-10 text-center font-mono text-xs text-muted-foreground">
            NO TRACKS IN FILTER
          </div>
        )}
        {filteredTracks.map((t) => (
          <div
            key={t.id}
            className={`mb-2 border border-panel-border border-l-[3px] px-3 py-2.5 transition-all duration-200 ${levelStyles[t.level]}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] font-bold tracking-[0.08em] text-foreground">
                {t.callsign}
              </span>
              <span className={`px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.08em] ${
                t.level === "RED" ? "text-threat-red" :
                t.level === "ORANGE" ? "text-orange-300" :
                t.level === "YELLOW" ? "text-threat-yellow" :
                "text-threat-green"
              }`}>
                {statusLabels[t.level]}
              </span>
            </div>
            <div className="mb-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">ALT</span>
              </div>
              <span className="font-mono text-right text-foreground">{t.altitudeM}m</span>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">SPD</span>
              </div>
              <span className="font-mono text-right text-foreground">{t.speedKts}kts</span>
              <div className="flex items-center gap-1.5">
                <Compass className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">HDG</span>
              </div>
              <span className="font-mono text-right text-foreground">{t.bearing.toFixed(0)}°</span>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">ETA</span>
              </div>
              <span className="font-mono text-right text-foreground">{formatEta(getTrackEtaSeconds(t))}</span>
            </div>
            <div className="flex items-center justify-between border-t border-panel-border/70 pt-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                ALT {getTrackDistanceKm(t).toFixed(1)}km
              </span>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  CONF {getTrackConfidence(t)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
