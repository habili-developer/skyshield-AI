import { useEffect, useRef, useState } from "react";
import { Send, Cpu } from "lucide-react";

interface Msg { role: "user" | "ai"; text: string; }

const PROTOCOLS: Record<string, string> = {
  red: "RED protocol active: Intercept authorization requested. Engage layered defense — RF jamming primary, kinetic backup. Confirm asset value before commit.",
  yellow: "YELLOW posture: Maintain track, request visual ID, prepare RF disruption package. No engagement without escalation.",
  jam: "RF jamming guidance: Sweep 2.4GHz / 5.8GHz / 433MHz control bands. Apply directional beam, monitor for re-acquisition.",
  intercept: "Intercept envelope: assess time-to-impact, asset criticality, collateral footprint. Prefer non-kinetic if TTL > 60s.",
};

interface Props { recentLevel: string; }

export function CopilotPanel({ recentLevel }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Awaiting simulation activity. I will provide real-time strategic analysis and alert explanations once targets are detected in the perimeter." },
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
    }, 600);
  };

  return (
    <div className="flex flex-1 flex-col border-t border-panel-border bg-panel">
      <div className="flex items-center gap-2 border-b border-panel-border px-3 py-2">
        <Cpu className="h-3.5 w-3.5 text-threat-red" />
        <h3 className="font-mono text-xs tracking-widest text-foreground">DEFENSIVE COPILOT</h3>
        <span className="ml-auto font-mono text-[10px] text-threat-green flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-threat-green blink" /> ONLINE
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-xs">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "ai" ? "" : "text-right"}>
            <p className={`inline-block max-w-[95%] rounded-sm border px-2.5 py-1.5 italic leading-relaxed ${
              m.role === "ai"
                ? "border-panel-border bg-background/60 text-muted-foreground"
                : "border-threat-red/40 bg-threat-red/10 not-italic text-foreground"
            }`}>
              {m.text}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex border-t border-panel-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Query defensive protocol..."
          className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          onClick={send}
          className="border-l border-panel-border px-3 text-threat-red hover:bg-threat-red/10"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
