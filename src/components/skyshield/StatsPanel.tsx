interface Props {
  cpu: number;
  mem: number;
  latency: number;
  sensors: string;
  tracks: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-panel-border bg-panel/60 px-3 py-2">
      <div className="font-mono text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function StatsPanel({ cpu, mem, latency, sensors, tracks }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      <Stat label="CPU LOAD" value={`${cpu.toFixed(1)}%`} />
      <Stat label="MEMORY" value={`${mem.toFixed(1)} GB`} />
      <Stat label="LATENCY" value={`${latency}ms`} />
      <Stat label="SENSORS" value={sensors} />
      <div className="col-span-2 border border-panel-border bg-panel/60 px-3 py-2">
        <div className="font-mono text-[10px] tracking-widest text-muted-foreground">
          ACTIVE TRACKS / KALMAN FILTERS
        </div>
        <div className="font-mono text-lg font-semibold tabular-nums text-threat-red">
          {tracks.toString().padStart(2, "0")} TRACKING
        </div>
      </div>
    </div>
  );
}
