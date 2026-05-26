import { useEffect, useState } from "react";
import { Shield, RefreshCw, Zap } from "lucide-react";

interface Props {
  tick: number;
  auto: boolean;
  onToggleAuto: () => void;
  onStep: () => void;
  onReset: () => void;
}

export function Header({ tick, auto, onToggleAuto, onStep, onReset }: Props) {
  const [currentTime, setCurrentTime] = useState("00:00:00");

  useEffect(() => {
    const sync = () => setCurrentTime(new Date().toISOString().slice(11, 19));
    sync();
    const timer = setInterval(sync, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="grid h-[58px] grid-cols-[1.6fr_1fr_1fr_1fr_auto] items-center border-b border-panel-border bg-panel px-4">
      <div className="flex min-w-0 items-center gap-3 border-r border-panel-border pr-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-threat-red/60 bg-threat-red/8 shadow-[0_0_18px_rgba(239,68,68,0.18)]">
          <Shield className="h-4 w-4 text-threat-red" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="font-mono text-[17px] font-bold tracking-[0.18em] text-foreground">
            SKYSHIELD AI
          </h1>
          <p className="truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            DODOMA SECTOR • REAL-TIME AIRSPACE DEFENSE
          </p>
        </div>
      </div>
      <HeaderMetric label="ZULU TIME" value={currentTime} />
      <HeaderMetric
        label="SYSTEM STATUS"
        value="FULLY OPERATIONAL"
        accent="text-threat-green"
        dot
      />
      <HeaderMetric label="SIM TICK" value={tick.toString().padStart(6, "0")} />
      <div className="flex items-center justify-end gap-2 pl-4">
        <button
          onClick={onToggleAuto}
          className={`h-9 min-w-[122px] border px-4 font-mono text-[11px] tracking-[0.08em] transition-all ${
            auto
              ? "border-threat-green/60 bg-threat-green/10 text-threat-green shadow-[0_0_18px_rgba(34,197,94,0.12)]"
              : "border-panel-border text-muted-foreground hover:border-threat-yellow/60 hover:text-threat-yellow"
          }`}
        >
          {auto ? "AUTO ENGAGED" : "AUTO STANDBY"}
        </button>
        <button
          onClick={onReset}
          className="flex h-9 w-9 items-center justify-center border border-panel-border text-muted-foreground transition-all hover:border-threat-red/60 hover:text-threat-red"
          title="Reset"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onStep}
          className="flex h-9 min-w-[122px] items-center justify-center gap-2 border border-threat-red/60 bg-threat-red/10 px-4 font-mono text-[11px] tracking-[0.08em] text-threat-red transition-all hover:bg-threat-red/18"
        >
          <Zap className="h-3.5 w-3.5" />
          EXECUTE STEP
        </button>
      </div>
    </header>
  );
}

function HeaderMetric({
  label,
  value,
  accent,
  dot = false,
}: {
  label: string;
  value: string;
  accent?: string;
  dot?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-center border-r border-panel-border px-4">
      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className={`mt-1 flex items-center gap-2 font-mono text-[18px] font-semibold tabular-nums text-foreground ${accent ?? ""}`}>
        {dot ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
        <span className="text-[15px]">{value}</span>
      </div>
    </div>
  );
}
