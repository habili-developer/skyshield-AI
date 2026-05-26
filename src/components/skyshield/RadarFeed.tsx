import { Radar, Activity, MapPin, Layers } from "lucide-react";
import type { Track } from "@/lib/simulation";

export function RadarFeed({ tracks }: { tracks: Track[] }) {
  return (
    <div className="border-t border-panel-border bg-panel px-6 py-3 glass-panel breathe">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 pulse-ring rounded-full bg-threat-red/20" />
            <Radar className="absolute inset-0 h-10 w-10 text-threat-red" strokeWidth={1.5} />
            <div className="absolute inset-0 rounded-full radar-sweep" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold tracking-[0.3em] text-foreground">
              ACTIVE RADAR FEED
            </span>
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              DODOMA SECTOR • 360° COVERAGE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <Stat label="DETECTED OBJECTS" value={tracks.length.toString()} icon={Activity} />
          <Stat label="SCANNING SECTOR" value="360° AUTO" icon={MapPin} />
          <Stat label="TRACKING MODE" value="KALMAN PREDICT" icon={Layers} />
        </div>
        <div className="ml-auto flex gap-4 overflow-x-auto">
          {tracks.slice(0, 6).map((t) => (
            <div 
              key={t.id} 
              className={`border border-panel-border px-3 py-2 font-mono text-[10px] whitespace-nowrap transition-all duration-200 ${
                t.level === "RED" ? "glow-red bg-threat-red/10" :
                t.level === "YELLOW" ? "glow-yellow bg-threat-yellow/10" : 
                "glow-green bg-threat-green/10"
              }`}
            >
              <span className={`mr-1 ${
                t.level === "RED" ? "text-threat-red" :
                t.level === "YELLOW" ? "text-threat-yellow" : "text-threat-green"
              }`}>● </span>
              <span className="font-bold">{t.callsign}</span> · {t.type} · {t.speedKts}kts · {t.altitudeM}m
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-threat-green" />
      <div>
        <div className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}
