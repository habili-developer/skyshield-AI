import { motion } from 'framer-motion';

const ExplainabilityPanel = ({ track }) => {
  if (!track) {
    return (
      <div className="glass-panel rounded-lg p-4 text-[10px] text-zinc-500">
        Select a track to view reasoning trace.
      </div>
    );
  }

  const trace = track.explanation_trace || [];
  const evidence = track.evidence_summary || track.evidence || {};
  const anomaly = track.anomaly || {};
  const evolution = track.confidence_evolution || {};

  return (
    <motion.div layout className="glass-panel rounded-lg p-3">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Explainability Trace</h2>
      <p className="mt-1 text-[9px] text-zinc-500">Auditable scoring rationale</p>

      <div className="mt-3 space-y-1">
        {trace.length === 0 ? (
          <p className="text-[10px] text-zinc-500">{track.explanation}</p>
        ) : (
          trace.map((line, idx) => (
            <motion.div
              key={`${line}-${idx}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              className="border-l-2 border-cyan-500/40 pl-2 text-[10px] text-zinc-300"
            >
              {line}
            </motion.div>
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
          <span className="text-zinc-500">Anomaly</span>
          <p className="font-bold uppercase text-amber-300">{anomaly.anomaly_label || 'n/a'}</p>
          <p className="text-zinc-400">{(anomaly.anomaly_score ?? 0).toFixed(2)} score</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
          <span className="text-zinc-500">Persistence</span>
          <p className="font-bold text-cyan-300">{evolution.suspicious_ticks ?? 0} ticks</p>
          <p className="text-zinc-400">accum {evolution.accumulated_weight ?? 0}</p>
        </div>
      </div>

      <p className="mt-2 text-[9px] text-zinc-500">
        Sensors: {(evidence.sensors_agreed || track.source_sensors || []).join(', ') || '—'}
      </p>
    </motion.div>
  );
};

export default ExplainabilityPanel;
