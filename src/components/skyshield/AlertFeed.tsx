import type { AlertItem } from "@/lib/simulation";

const levelStyles = {
  RED: "border-l-threat-red text-threat-red",
  YELLOW: "border-l-threat-yellow text-threat-yellow",
  GREEN: "border-l-threat-green text-threat-green",
} as const;

export function AlertFeed({
  alerts,
  onAck,
}: {
  alerts: AlertItem[];
  onAck: (id: string) => void;
}) {
  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-panel-border bg-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-2">
        <h2 className="font-mono text-xs tracking-widest text-muted-foreground">
          THREAT ALERT FEED
        </h2>
        <span className="font-mono text-[10px] text-threat-red">
          {alerts.filter((a) => !a.acknowledged).length} ACTIVE
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 && (
          <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
            NO ACTIVE THREATS DETECTED
          </div>
        )}
        {alerts.map((a) => (
          <div
            key={a.id}
            className={`border-b border-panel-border border-l-2 ${
              levelStyles[a.level]
            } px-4 py-3 ${a.acknowledged ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold tracking-widest">
                {a.level}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {new Date(a.ts).toLocaleTimeString("en-US", { hour12: true })}
              </span>
            </div>
            <h3 className="mt-1 font-mono text-sm font-semibold text-foreground">
              {a.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {a.body}
            </p>
            {!a.acknowledged && (
              <button
                onClick={() => onAck(a.id)}
                className="mt-2 font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground"
              >
                ▸ ACKNOWLEDGE
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
