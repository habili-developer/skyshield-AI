import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveSensorFeed = ({ feed = [] }) => {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  const formatTime = item => {
    if (!item.timestamp) return `T-${String(item.tick || 0).padStart(4, '0')}`;
    const date = new Date(Number(item.timestamp) * (Number(item.timestamp) < 10000000000 ? 1000 : 1));
    return date.toLocaleTimeString();
  };

  return (
    <motion.div className="glass-panel flex h-full flex-col overflow-hidden rounded-lg">
      <div className="flex items-center gap-2 border-b border-zinc-800/80 px-3 py-2.5">
        <span className="live-dot" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Sensor Feed</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[10px]">
        <AnimatePresence initial={false}>
          {feed.length === 0 ? (
            <p className="py-6 text-center text-zinc-600">Awaiting live detections…</p>
          ) : (
            [...feed].slice(0, 60).map((item, idx) => (
              <motion.div
                key={`${item.tick}-${item.timestamp}-${item.type}-${item.target_id}-${idx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`feed-enter live-event-row mb-1.5 rounded border px-2 py-1.5 ${
                  item.type === 'escalation'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    : item.type === 'anomaly_trigger'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                      : item.type === 'opensky' || item.type === 'adsb'
                        ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100'
                      : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
                }`}
              >
                <span className="text-zinc-500">{formatTime(item)}</span>
                <span className="mx-1 text-zinc-600">|</span>
                <span className="uppercase text-cyan-400">{item.type}</span>
                {item.confidence != null && (
                  <span className="float-right text-zinc-500">{(item.confidence * 100).toFixed(0)}%</span>
                )}
                <div className="mt-0.5 text-zinc-400">{item.message}</div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </motion.div>
  );
};

export default LiveSensorFeed;
