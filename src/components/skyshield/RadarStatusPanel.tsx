import { Radar, Activity, MapPin, Layers } from "lucide-react";

export function RadarStatusPanel() {
  return (
    <div className="flex min-h-0 flex-col bg-panel">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
        <Radar className="h-3.5 w-3.5 text-threat-red" />
        <h3 className="font-mono text-[10px] tracking-[0.2em] text-foreground">
          RADAR STATUS
        </h3>
      </div>
      <div className="grid flex-1 grid-cols-[96px_1fr] gap-4 px-4 py-3">
        <div className="flex items-center justify-center border border-panel-border bg-black/20">
          <div className="relative h-16 w-16 rounded-full border border-threat-green/30">
            <div className="absolute inset-2 rounded-full border border-threat-green/20" />
            <div className="absolute inset-4 rounded-full border border-threat-green/20" />
            <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 origin-bottom bg-threat-green/70 radar-status-sweep" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-threat-green shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <StatusRow label="MODE" value="360° SURVEILLANCE" icon={Radar} color="text-threat-green" />
          <StatusRow label="RANGE" value="20 KM" icon={MapPin} color="text-threat-green" />
          <StatusRow label="RESOLUTION" value="HIGH" icon={Layers} color="text-threat-green" />
          <StatusRow label="UPDATE RATE" value="1.0 SEC" icon={Activity} color="text-threat-green" />
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-[9px] text-muted-foreground">STATUS</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-threat-green">
              <span className="h-1.5 w-1.5 rounded-full bg-threat-green blink" />
              OPTIMAL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color}`} />
        <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">{label}</span>
      </div>
      <span className={`font-mono text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
