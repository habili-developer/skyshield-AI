import { Cpu, HardDrive, Activity, Wifi, Target } from "lucide-react";

interface Props {
  cpu: number;
  mem: number;
  latency: number;
  sensors: string;
  tracks: number;
}

function Stat({ 
  label, 
  value, 
  icon: Icon,
  colorClass 
}: { 
  label: string; 
  value: string;
  icon: any;
  colorClass: string;
}) {
  return (
    <div className="border border-panel-border bg-panel/70 px-4 py-3 glass-panel transition-all duration-200 hover:bg-panel/90">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
        <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">{label}</div>
      </div>
      <div className={`font-mono text-xl font-bold tabular-nums ${colorClass}`}>{value}</div>
    </div>
  );
}

export function StatsPanel({ cpu, mem, latency, sensors, tracks }: Props) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Activity className="h-4 w-4 text-threat-red" />
        <h2 className="font-mono text-xs tracking-[0.3em] text-foreground">
          SYSTEM TELEMETRY
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat 
          label="CPU LOAD" 
          value={`${cpu.toFixed(1)}%`} 
          icon={Cpu}
          colorClass={cpu > 70 ? "text-threat-red" : "text-threat-green"}
        />
        <Stat 
          label="MEMORY" 
          value={`${mem.toFixed(1)} GB`} 
          icon={HardDrive}
          colorClass={mem > 3.5 ? "text-threat-red" : "text-threat-green"}
        />
        <Stat 
          label="LATENCY" 
          value={`${latency}ms`} 
          icon={Activity}
          colorClass={latency > 30 ? "text-threat-yellow" : "text-threat-green"}
        />
        <Stat 
          label="SENSORS" 
          value={sensors} 
          icon={Wifi}
          colorClass="text-threat-green"
        />
        <div className="col-span-2 border border-panel-border bg-panel/70 px-4 py-3 glass-panel">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3.5 w-3.5 text-threat-red" />
            <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
              ACTIVE TRACKS / KALMAN FILTERS
            </div>
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-threat-red">
            {tracks.toString().padStart(2, "0")} TRACKING
          </div>
        </div>
      </div>
    </div>
  );
}
