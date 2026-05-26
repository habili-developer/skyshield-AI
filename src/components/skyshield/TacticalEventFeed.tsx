import { Clock } from "lucide-react";

export function TacticalEventFeed({
  events,
}: {
  events: Array<{
    id: string;
    ts: number;
    code: "INFO" | "WARNING" | "ALERT";
    body: string;
  }>;
}) {
  const colorForCode = (code: "INFO" | "WARNING" | "ALERT") =>
    code === "ALERT" ? "text-threat-red" : code === "WARNING" ? "text-threat-yellow" : "text-threat-green";

  return (
    <div className="flex min-h-0 flex-col border-r border-panel-border bg-panel">
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-threat-red" />
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-foreground">
            TACTICAL EVENT FEED
          </h3>
        </div>
        <span className="font-mono text-[10px] tracking-[0.14em] text-threat-green">LIVE</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {events.length === 0 ? (
          <div className="font-mono text-[11px] text-muted-foreground">SECTOR QUIET</div>
        ) : (
          <div className="space-y-1.5">
            {events.map((event) => (
              <div key={event.id} className="grid grid-cols-[54px_74px_minmax(0,1fr)] items-start gap-2 font-mono text-[11px] leading-5">
                <span className="tabular-nums text-orange-300">
                  {new Date(event.ts).toISOString().slice(11, 19)}
                </span>
                <span className={`font-semibold ${colorForCode(event.code)}`}>[{event.code}]</span>
                <span className={colorForCode(event.code)}>{event.body}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
