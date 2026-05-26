import { DODOMA } from "@/lib/simulation";

export function Footer() {
  return (
    <footer className="border-t border-panel-border bg-panel px-4 py-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted-foreground">
        <div>
          COORDINATES: {DODOMA[0].toFixed(4)}°E, {Math.abs(DODOMA[1]).toFixed(4)}°S
        </div>
        <div className="flex gap-4">
          <span>ENCRYPTION: AES-256-GCM</span>
          <span>PROTOCOLS: WEBSOCKET / FASTAPI / MAPLIBRE</span>
          <span className="text-threat-green">● LIVE STREAM ACTIVE</span>
        </div>
      </div>
    </footer>
  );
}
