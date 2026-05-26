import { Radar } from "lucide-react";
import type { Track } from "@/lib/simulation";

export function RadarFeed({ tracks }: { tracks: Track[] }) {
  return (
    <div className="border-t border-panel-border bg-panel px-4 py-2">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <Radar className="absolute inset-0 h-8 w-8 text-threat-red" strokeWidth={1.5} />
            <div className="absolute inset-0 rounded-full radar-sweep" />
          </div>
          <span className="font-mono text-xs font-bold tracking-widest text-foreground">
            ACTIVE RADAR FEED
          </span>
        </div>
        <Stat label="DETECTED OBJECTS" value={tracks.length.toString()} />
        <Stat label="SCANNING SECTOR" value="360° AUTO" />
        <Stat label="MODE" value="KALMAN PREDICT" />
        <div className="ml-auto flex gap-3 overflow-x-auto">
          {tracks.slice(0, 6).map((t) => (
            <div key={t.id} className="border border-panel-border px-2 py-1 font-mono text-[10px] whitespace-nowrap">
              <span className={
                t.level === "RED" ? "text-threat-red" :
                t.level === "YELLOW" ? "text-threat-yellow" : "text-threat-green"
              }>● </span>
              {t.callsign} · {t.type} · {t.speedKts}kts · {t.altitudeM}m
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}
