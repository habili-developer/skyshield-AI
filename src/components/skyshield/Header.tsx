import { Shield, RefreshCw, Zap } from "lucide-react";

interface Props {
  tick: number;
  auto: boolean;
  onToggleAuto: () => void;
  onStep: () => void;
  onReset: () => void;
}

export function Header({ tick, auto, onToggleAuto, onStep, onReset }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-panel-border bg-panel px-5 py-3">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-threat-red" strokeWidth={1.6} />
        <div>
          <h1 className="font-mono text-xl font-bold tracking-wider text-foreground">
            SKYSHIELD AI
          </h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            MULTI-SENSOR DEFENSE GRID
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            SYSTEM STATUS
          </span>
          <span className="font-mono text-sm font-semibold text-threat-green flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-threat-green blink" />
            CONNECTED
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            SIM TICK
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {tick.toString().padStart(4, "0")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleAuto}
            className={`font-mono text-xs px-3 py-1.5 border ${
              auto
                ? "border-threat-green text-threat-green bg-threat-green/10"
                : "border-panel-border text-muted-foreground"
            } hover:bg-accent transition-colors`}
          >
            AUTO {auto ? "ON" : "OFF"}
          </button>
          <button
            onClick={onReset}
            className="p-1.5 border border-panel-border text-muted-foreground hover:bg-accent transition-colors"
            title="Reset"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onStep}
            className="font-mono text-xs px-3 py-1.5 border border-threat-red bg-threat-red/10 text-threat-red hover:bg-threat-red/20 transition-colors flex items-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            PROCESS STEP
          </button>
        </div>
      </div>
    </header>
  );
}
