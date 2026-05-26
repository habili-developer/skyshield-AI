import { motion, AnimatePresence } from 'framer-motion';

const EventTimeline = ({ entries = [] }) => (
  <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0d10]">
    <div className="border-b border-zinc-800 px-4 py-3">
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Event Timeline</h2>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <AnimatePresence initial={false}>
        {entries.length === 0 ? (
          <p className="text-center text-[10px] text-zinc-600">No timeline events yet.</p>
        ) : (
          [...entries].reverse().slice(0, 20).map((entry, idx) => (
            <motion.div
              key={`${entry.tick}-${entry.event}-${entry.target_id}-${idx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative mb-3 border-l-2 border-cyan-500/40 pl-3"
            >
              <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                T-{String(entry.tick).padStart(4, '0')}
              </div>
              <div className="text-[10px] text-zinc-300">
                <span className="font-semibold text-cyan-400">{entry.event}</span>
                {entry.target_id && <span className="text-zinc-500"> · {entry.target_id}</span>}
                {entry.sensor_type && <span className="text-zinc-500"> · {entry.sensor_type}</span>}
                {entry.threat_level && (
                  <span className="ml-1 uppercase text-amber-400">{entry.threat_level}</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  </div>
);

export default EventTimeline;
