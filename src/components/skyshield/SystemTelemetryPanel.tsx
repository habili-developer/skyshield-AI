import { Cpu, HardDrive, Activity, Wifi } from "lucide-react";

interface Props {
  cpu: number;
  mem: number;
  latency: number;
  sensors: string;
}

export function SystemTelemetryPanel({ cpu, mem, latency, sensors }: Props) {
  return (
    <div className="flex min-h-0 flex-col border-r border-panel-border bg-panel">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
        <Activity className="h-3.5 w-3.5 text-threat-red" />
        <h3 className="font-mono text-[10px] tracking-[0.2em] text-foreground">
          SYSTEM TELEMETRY
        </h3>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-3 px-4 py-3">
        <TelemetryCard label="CPU" value={`${cpu.toFixed(0)}%`} icon={Cpu} series={[6, 10, 8, 15, 12, 24, 18, 16, 20, 14, 12, 16]} accent="text-threat-green" />
        <TelemetryCard label="MEMORY" value={`${mem.toFixed(1)}GB / 4 GB`} icon={HardDrive} series={[12, 11, 13, 11, 14, 15, 14, 16, 17, 16, 18, 17]} accent="text-threat-green" />
        <TelemetryCard label="LATENCY" value={`${latency}ms`} icon={Activity} series={[4, 6, 5, 7, 5, 9, 6, 10, 6, 7, 5, 8]} accent="text-threat-green" />
        <TelemetryCard label="SENSORS" value={sensors} icon={Wifi} series={[10, 18, 12, 22, 12, 16, 10, 20, 12, 18, 10, 14]} accent="text-threat-green" />
      </div>
    </div>
  );
}

function TelemetryCard({
  label,
  value,
  icon: Icon,
  accent,
  series,
}: {
  label: string;
  value: string;
  icon: any;
  accent: string;
  series: number[];
}) {
  return (
    <div className="flex flex-col justify-between border border-panel-border bg-black/20 px-3 py-2.5">
      <div>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${accent}`} />
          <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">{label}</span>
        </div>
        <div className="mt-3 font-mono text-[18px] font-semibold tabular-nums text-foreground">{value}</div>
      </div>
      <MiniSparkline series={series} />
    </div>
  );
}

function MiniSparkline({ series }: { series: number[] }) {
  const width = 108;
  const height = 28;
  const step = width / (series.length - 1);
  const path = series
    .map((value, index) => `${index === 0 ? "M" : "L"} ${index * step} ${height - value}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-7 w-full">
      <path d={path} fill="none" stroke="#22c55e" strokeWidth="1.8" />
    </svg>
  );
}
