import { motion } from 'framer-motion';

const SENSOR_LABELS = {
  radar: 'Radar',
  rf: 'RF',
  camera: 'Camera',
  thermal: 'Thermal',
  acoustic: 'Acoustic',
  adsb: 'ADS-B',
};

const SensorActivity = ({ events = [] }) => {
  const counts = events.reduce((acc, event) => {
    const key = event.sensor_type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div layout className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0d10]">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Sensor Activity</h2>
        <p className="mt-1 text-[10px] text-zinc-500">Live multi-sensor event feed</p>
      </div>
      <motion.div className="grid grid-cols-2 gap-2 p-3">
        {Object.keys(SENSOR_LABELS).map(sensor => (
          <div key={sensor} className="rounded-lg border border-zinc-800 bg-[#09090b] px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{SENSOR_LABELS[sensor]}</div>
            <motion.div
              key={counts[sensor] || 0}
              initial={{ scale: 0.9, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mt-1 text-lg font-black text-cyan-300"
            >
              {counts[sensor] || 0}
            </motion.div>
          </div>
        ))}
      </motion.div>
      <div className="min-h-0 flex-1 overflow-auto border-t border-zinc-800 p-2">
        {events.length === 0 ? (
          <p className="px-2 py-4 text-center text-[10px] text-zinc-600">Awaiting sensor events…</p>
        ) : (
          [...events].reverse().slice(0, 12).map(event => (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-1 rounded border border-zinc-800/80 bg-zinc-950/60 px-2 py-1.5 text-[10px]"
            >
              <span className="font-bold uppercase text-cyan-400">{event.sensor_type}</span>
              <span className="text-zinc-600"> · </span>
              <span className="text-zinc-400">{event.target_id}</span>
              <span className="float-right text-zinc-500">{(event.confidence * 100).toFixed(0)}%</span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default SensorActivity;
