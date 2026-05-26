import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Terminal, Activity, Shield, Radio } from "lucide-react";
import type { Track, ThreatLevel } from "@/lib/simulation";
import { formatEta, getTrackConfidence, getTrackEtaSeconds } from "@/lib/simulation";

interface Msg { role: "user" | "ai"; text: string; }

const PROTOCOLS: Record<string, string> = {
  red: "RED PROTOCOL ACTIVE: Intercept authorization requested. Engage layered defense — RF jamming primary, kinetic backup. Confirm asset value before commit.",
  yellow: "YELLOW POSTURE: Maintain track, request visual ID, prepare RF disruption package. No engagement without escalation.",
  jam: "RF JAMMING GUIDANCE: Sweep 2.4GHz / 5.8GHz / 433MHz control bands. Apply directional beam, monitor for re-acquisition.",
  intercept: "INTERCEPT ENVELOPE: Assess time-to-impact, asset criticality, collateral footprint. Prefer non-kinetic if TTL > 60s.",
};

interface Props { recentLevel: ThreatLevel; tracks: Track[]; }

export function CopilotPanel({ recentLevel, tracks }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "SkyShield Defensive Copilot online. Standing by for tactical queries and real-time threat assessment." },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTimeout(() => {
      const k = Object.keys(PROTOCOLS).find((k) => q.toLowerCase().includes(k));
      const reply = k
        ? PROTOCOLS[k]
        : `Analyzing query against ${recentLevel} posture. Current sector: DODOMA. Kalman-filtered tracks indicate steady inbound vectors. Recommend continued passive surveillance and ROE confirmation.`;
      setMsgs((m) => [...m, { role: "ai", text: reply }]);
    }, 800);
  };

  const criticalTrack =
    tracks.find((t) => t.level === "RED") ||
    tracks.find((t) => t.level === "ORANGE") ||
    tracks.find((t) => t.level === "YELLOW") ||
    tracks[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel">
      <div className="flex items-center gap-3 border-b border-panel-border px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-threat-red" />
        <h3 className="font-mono text-[11px] tracking-[0.14em] text-foreground">AI DEFENSIVE COPILOT</h3>
        <span className="ml-auto font-mono text-[10px] tracking-[0.12em] text-threat-green">
          ONLINE
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <PanelSection title="CURRENT ASSESSMENT" icon={Activity} accent="text-threat-red">
          <p className="font-mono text-[12px] leading-5 text-foreground">
            {criticalTrack
              ? `${criticalTrack.callsign} is projected to approach the restricted core in ${formatEta(getTrackEtaSeconds(criticalTrack))}. Immediate attention required.`
              : "Sector stable. No hostile vectors converging on the restricted core."}
          </p>
        </PanelSection>
        {criticalTrack ? (
          <>
            <PanelSection title="THREAT ANALYSIS" icon={Shield}>
              <ul className="space-y-1 font-mono text-[11px] leading-5 text-muted-foreground">
                <li>• {criticalTrack.callsign} classified as {criticalTrack.type}</li>
                <li>• High-speed, direct approach vector</li>
                <li>• Altitude profile optimized for intrusion</li>
                <li>• No cooperative transponder response</li>
                <li>• RF signature match: {criticalTrack.type === "UNKNOWN" ? "UNKNOWN" : "UNVERIFIED"}</li>
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">THREAT LEVEL: CRITICAL</span>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }, (_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-5 border border-threat-red/40 ${
                        index < (criticalTrack.level === "RED" ? 7 : criticalTrack.level === "ORANGE" ? 5 : 3)
                          ? "bg-threat-red"
                          : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </PanelSection>
            <PanelSection title="PREDICTION (KALMAN FILTER)" icon={Terminal}>
              <ul className="space-y-1 font-mono text-[11px] leading-5 text-muted-foreground">
                <li>• Model: Constant Velocity</li>
                <li>• Confidence: {getTrackConfidence(criticalTrack)}%</li>
                <li>• Predicted Path: 6 points</li>
                <li>• Next Position: {formatEta(Math.max(1, getTrackEtaSeconds(criticalTrack) - 30))}</li>
                <li>• Breach Probability: {criticalTrack.level === "RED" ? "89%" : criticalTrack.level === "ORANGE" ? "71%" : "42%"}</li>
              </ul>
              <div className="mt-3 h-14 rounded-sm border border-panel-border bg-black/20 p-2">
                <svg viewBox="0 0 180 40" className="h-full w-full">
                  <path d="M8 30 C42 15, 70 10, 98 12 S146 20, 172 26" fill="none" stroke="#ef4444" strokeWidth="2" />
                  {[8, 42, 74, 106, 138, 172].map((x, idx) => (
                    <circle key={x} cx={x} cy={idx === 5 ? 26 : 30 - idx * 3} r={idx === 5 ? 4 : 2.5} fill={idx === 5 ? "#ef4444" : "#fb7185"} />
                  ))}
                </svg>
              </div>
            </PanelSection>
          </>
        ) : null}
        <PanelSection title="SENSOR FUSION" icon={Radio}>
          <div className="grid grid-cols-2 gap-3 font-mono text-[11px] leading-5">
            <Signal label="RADAR TRACKING" value="ACTIVE" tone="text-threat-green" />
            <Signal label="RF DETECTION" value="ANOMALY" tone="text-threat-yellow" />
            <Signal label="EO/IR" value="CLEAR" tone="text-threat-green" />
            <Signal label="ACOUSTIC" value="LOW" tone="text-threat-yellow" />
          </div>
        </PanelSection>
        <PanelSection title="OPERATOR QUERY" icon={Terminal}>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {msgs.map((m, i) => (
              <div key={i}>
                <div className="mb-1 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
                  {m.role === "ai" ? "COPILOT" : "OPERATOR"}
                </div>
                <div
                  className={`border px-2.5 py-2 font-mono text-[11px] leading-5 ${
                    m.role === "ai"
                      ? "border-panel-border bg-black/20 text-muted-foreground"
                      : "border-threat-red/30 bg-threat-red/8 text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </PanelSection>
      </div>
      <div className="flex border-t border-panel-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask SkyShield AI..."
          className="flex-1 bg-transparent px-4 py-3 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          onClick={send}
          className="flex items-center gap-2 border-l border-panel-border px-4 text-threat-red transition-all duration-200 hover:bg-threat-red/10"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="font-mono text-[9px] tracking-[0.14em]">TRANSMIT</span>
        </button>
      </div>
    </div>
  );
}

function PanelSection({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: any;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-3 border border-panel-border bg-black/20">
      <div className="flex items-center gap-2 border-b border-panel-border px-3 py-2">
        <Icon className={`h-3.5 w-3.5 ${accent ?? "text-muted-foreground"}`} />
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{title}</span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function Signal({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border border-panel-border bg-black/20 px-2.5 py-2">
      <div className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-[11px] font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
