import type { AlertItem } from "@/lib/simulation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const levelStyles = {
  RED: "border-l-threat-red text-threat-red glow-red bg-threat-red/5",
  YELLOW: "border-l-threat-yellow text-threat-yellow glow-yellow bg-threat-yellow/5",
  GREEN: "border-l-threat-green text-threat-green glow-green bg-threat-green/5",
} as const;

export function AlertFeed({
  alerts,
  onAck,
}: {
  alerts: AlertItem[];
  onAck: (id: string) => void;
}) {
  const activeAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-panel-border bg-panel glass-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-threat-red" />
          <h2 className="font-mono text-xs tracking-[0.3em] text-foreground">
            THREAT ALERT FEED
          </h2>
        </div>
        <span className={`font-mono text-[11px] tracking-[0.2em] ${activeAlerts > 0 ? "text-threat-red blink" : "text-threat-green"}`}>
          {activeAlerts} ACTIVE
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 && (
          <div className="px-5 py-10 text-center font-mono text-xs text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-threat-green opacity-60" />
            NO ACTIVE THREATS DETECTED
          </div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`border-b border-panel-border border-l-4 ${
              levelStyles[a.level]
            } px-5 py-4 transition-all duration-300 ${a.acknowledged ? "opacity-40 grayscale" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-xs font-bold tracking-[0.3em] ${a.acknowledged ? "line-through" : ""}`}>
                {a.level} ALERT
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {new Date(a.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <h3 className="font-mono text-sm font-semibold text-foreground mb-1">
              {a.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground mb-3">
              {a.body}
            </p>
            {!a.acknowledged && (
              <button
                onClick={() => onAck(a.id)}
                className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground hover:text-foreground hover:bg-accent px-3 py-1 border border-panel-border transition-all duration-200"
              >
                ▸ ACKNOWLEDGE ALERT
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
