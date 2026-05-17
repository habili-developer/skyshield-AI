import { motion } from 'framer-motion';

const LEVEL_STYLES = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  orange: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  red: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

export default function ThreatPanel({ track }) {
  if (!track) {
    return (
      <motion.div className="rounded-lg border border-zinc-800 bg-[#0d0d10] p-4 text-[11px] text-zinc-500">
        No active track selected.
      </motion.div>
    );
  }

  const level = (track.threat_level || 'green').toLowerCase();
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.green;

  return (
    <motion.div layout className={`rounded-lg border p-4 transition-colors duration-500 ${style}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Threat Panel</p>
      <p className="mt-2 text-xl font-black uppercase tracking-wide">{level}</p>
      <p className="mt-1 text-[11px] font-semibold text-white">{track.title || 'Monitoring'}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-zinc-500">Score</span>
          <p className="font-bold">{track.threat_score ?? 0}/100</p>
        </div>
        <div>
          <span className="text-zinc-500">Fusion</span>
          <p className="font-bold">
            {track.fusion_confidence != null ? `${(track.fusion_confidence * 100).toFixed(0)}%` : '—'}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-zinc-500">Classification</span>
          <p className="font-semibold uppercase">{track.classification || 'unknown'}</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed opacity-90">{track.explanation}</p>
    </motion.div>
  );
}
